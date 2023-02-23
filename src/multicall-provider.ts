import { BytesLike, Deferrable } from "ethers/lib/utils";

import { BlockTag, Provider, TransactionRequest } from "@ethersproject/providers";

import { Multicall3, Multicall3__factory } from "./types";

export interface ContractCall {
  to: string;
  data: BytesLike;
  blockTag: BlockTag;
}

export interface QueuedContractCall {
  resolve: (value: MulticallResult | PromiseLike<MulticallResult>) => void;
  reject: (reason?: any) => void;
  call: ContractCall;
}

export type MulticallResult = Multicall3.ResultStructOutput | { error: any };

export class MulticallProvider {
  public static wrap<T extends Provider>(provider: T) {
    // let multicall2: Multicall2;
    const multicall3 = Multicall3__factory.connect(
      // same address on all networks (cf. https://github.com/mds1/multicall#deployments)
      "0xcA11bde05977b3631167028862bE2a173976CA11",
      provider
    );

    const queuedCalls: { [id: string]: QueuedContractCall } = {};

    const _provider = Object.assign(Object.create(Object.getPrototypeOf(provider)), provider) as T;
    //   Object.entries(Object.getOwnPropertyDescriptors(__provider)).forEach(([key, descriptor]) => {
    //     Object.defineProperty(this, key, descriptor);
    //   });
    const _call = _provider.call;

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

          try {
            const res = await multicall3.callStatic.tryAggregate(false, callStructs, {
              blockTag: blockTagQueuedCalls[0].call.blockTag,
            });

            if (res.length !== callStructs.length)
              throw new Error(
                `Unexpected multicall response length: received ${res.length}; expected ${callStructs.length}`
              );

            blockTagQueuedCalls.forEach(({ resolve }, i) => {
              resolve(res[i]);
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
      transaction: Deferrable<TransactionRequest>,
      blockTag?: BlockTag | Promise<BlockTag>
    ): Promise<string> => {
      const [to, data, resolvedBlockTag] = await Promise.all([
        transaction.to,
        transaction.data,
        blockTag ?? "latest",
      ]);

      if (!to || !data) return _call(Object.assign(transaction, { to, data }), blockTag);

      setTimeout(performMulticall, 10);

      const res = await new Promise<MulticallResult>((resolve, reject) => {
        const call: ContractCall = {
          to,
          data,
          blockTag: resolvedBlockTag,
        };

        queuedCalls[call.to + call.data + call.blockTag.toString()] = {
          resolve,
          reject,
          call,
        };
      });

      if ("error" in res) throw res.error;

      return res.returnData;
    };

    return _provider;
  }
}

export default MulticallProvider;
