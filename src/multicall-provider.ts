import { BytesLike } from "ethers/lib/utils";

import { BaseProvider, BlockTag, TransactionRequest } from "@ethersproject/providers";

import { multicall2Address, multicall3Address, multicallAddresses } from "./constants";
import { Multicall2__factory, Multicall3__factory } from "./types";
import { getBlockNumber, getMulticallVersion } from "./utils";

export enum MulticallVersion {
  V2 = "2",
  V3 = "3",
}

export interface ContractCall {
  to: string;
  data: BytesLike;
  blockTag: BlockTag;
  multicallVersion: MulticallVersion;
  resolve: (value: string | PromiseLike<string>) => void;
  reject: (reason?: any) => void;
}

export class MulticallProvider {
  public static wrap<T extends BaseProvider>(provider: T, timeout = 12) {
    const multicall2 = Multicall2__factory.connect(multicall2Address, provider);
    const multicall3 = Multicall3__factory.connect(multicall3Address, provider);

    const queuedCalls: { [id: string]: ContractCall } = {};

    const prototype = Object.getPrototypeOf(provider);
    const _provider = Object.assign(
      Object.create(
        prototype,
        Object.fromEntries(
          Object.entries(Object.getOwnPropertyDescriptors(prototype)).map(([name, descriptor]) => [
            name,
            {
              ...descriptor,
              ...(descriptor.value && { value: descriptor.value.bind(provider) }),
              ...(descriptor.get && { get: descriptor.get.bind(provider) }),
              ...(descriptor.set && { set: descriptor.set.bind(provider) }),
            },
          ])
        )
      ),
      provider
    ) as T;

    const _perform = provider.perform.bind(provider);

    const performMulticall = async () => {
      const _queuedCalls = Object.entries(queuedCalls).map(([key, queuedCall]) => {
        delete queuedCalls[key];

        return queuedCall;
      });

      if (_queuedCalls.length === 0) return;

      const blockTagCalls = _queuedCalls.reduce((acc, queuedCall) => {
        const blockTag = queuedCall.blockTag.toString();

        return {
          ...acc,
          [blockTag]: [queuedCall].concat(acc[blockTag] ?? []),
        };
      }, {} as { [blockTag: BlockTag]: ContractCall[] });

      return Promise.all(
        Object.values(blockTagCalls).map(async (blockTagQueuedCalls) => {
          const { blockTag, multicallVersion } = blockTagQueuedCalls[0];

          const callStructs = blockTagQueuedCalls.map(({ to, data }) => ({
            target: to,
            callData: data,
          }));

          const multicall = multicallVersion === MulticallVersion.V2 ? multicall2 : multicall3;

          try {
            const res = await multicall.callStatic.tryAggregate(false, callStructs, { blockTag });

            if (res.length !== callStructs.length)
              throw new Error(
                `Unexpected multicall response length: received ${res.length}; expected ${callStructs.length}`
              );

            blockTagQueuedCalls.forEach(({ resolve }, i) => {
              resolve(res[i].returnData);
            });
          } catch (error: any) {
            blockTagQueuedCalls.forEach(({ reject }) => {
              reject(error);
            });
          }
        })
      );
    };

    _provider.perform = async function (method: string, params: any): Promise<string> {
      if (method !== "call") return _perform(method, params);

      const {
        transaction: { to, data },
        blockTag,
      } = params as {
        transaction: TransactionRequest;
        blockTag: BlockTag;
      };

      const blockNumber = getBlockNumber(blockTag);
      const multicallVersion = getMulticallVersion(blockNumber, this.network.chainId);

      if (!to || !data || multicallVersion == null || multicallAddresses.has(to.toLowerCase()))
        return _perform(method, params);

      setTimeout(performMulticall, timeout);

      return new Promise<string>((resolve, reject) => {
        queuedCalls[to + data + blockTag.toString()] = {
          to,
          data,
          blockTag,
          multicallVersion,
          resolve,
          reject,
        };
      });
    };

    return _provider;
  }
}

export default MulticallProvider;
