import { BytesLike, Deferrable } from "ethers/lib/utils";

import { BlockTag, Provider, TransactionRequest } from "@ethersproject/providers";

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
}

export interface QueuedContractCall {
  resolve: (value: string | PromiseLike<string>) => void;
  reject: (reason?: any) => void;
  call: ContractCall;
}

export class MulticallProvider {
  public static wrap<T extends Provider>(provider: T) {
    const multicall2 = Multicall2__factory.connect(multicall2Address, provider);
    const multicall3 = Multicall3__factory.connect(multicall3Address, provider);

    const queuedCalls: { [id: string]: QueuedContractCall } = {};

    const _provider = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider) as T;
    const _call = _provider.call.bind(_provider);

    const performMulticall = async () => {
      const _queuedCalls = Object.entries(queuedCalls).map(([key, queuedCall]) => {
        delete queuedCalls[key];

        return queuedCall;
      });

      if (_queuedCalls.length === 0) return;

      const blockTagCalls = _queuedCalls.reduce((acc, queuedCall) => {
        const blockTag = queuedCall.call.blockTag.toString();

        return {
          ...acc,
          [blockTag]: [queuedCall].concat(acc[blockTag] ?? []),
        };
      }, {} as { [blockTag: BlockTag]: QueuedContractCall[] });

      return Promise.all(
        Object.values(blockTagCalls).map(async (blockTagQueuedCalls) => {
          const callStructs = blockTagQueuedCalls.map((queuedCall) => ({
            target: queuedCall.call.to,
            callData: queuedCall.call.data,
          }));

          const multicall =
            blockTagQueuedCalls[0].call.multicallVersion === MulticallVersion.V2
              ? multicall2
              : multicall3;

          try {
            const res = await multicall.callStatic.tryAggregate(false, callStructs, {
              blockTag: blockTagQueuedCalls[0].call.blockTag,
            });

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

    _provider.call = async (
      promisedTransaction: Deferrable<TransactionRequest>,
      promisedBlockTag?: BlockTag | Promise<BlockTag>
    ): Promise<string> => {
      const [to, data, blockTag, { chainId }] = await Promise.all([
        promisedTransaction.to,
        promisedTransaction.data,
        promisedBlockTag ?? "latest",
        _provider.getNetwork(),
      ]);

      const blockNumber = getBlockNumber(blockTag);
      const multicallVersion = getMulticallVersion(blockNumber, chainId);

      if (!to || !data || multicallVersion == null || multicallAddresses.has(to.toLowerCase()))
        return _call({ ...promisedTransaction, to, data }, blockTag);

      setTimeout(performMulticall, 10);

      return new Promise<string>((resolve, reject) => {
        queuedCalls[to + data + blockTag.toString()] = {
          resolve,
          reject,
          call: {
            to,
            data,
            blockTag,
            multicallVersion,
          },
        };
      });
    };

    return _provider;
  }
}

export default MulticallProvider;
