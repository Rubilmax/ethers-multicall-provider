import { BytesLike } from "ethers/lib/utils";
import { DebouncedFunc } from "lodash";
import _debounce from "lodash/debounce";

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

export type MulticallProvider<T extends BaseProvider = BaseProvider> = T & {
  readonly _isMulticallProvider: boolean;

  _multicallDelay: number;
  multicallDelay: number;
  maxMulticallDataLength: number;
  isMulticallEnabled: boolean;

  _performMulticall: () => Promise<void>;
  _debouncedPerformMulticall: DebouncedFunc<() => Promise<void>>;
};

export class MulticallWrapper {
  /**
   * Returns whether a given provider is a multicall-enabled provider.
   * @param provider The provider to check.
   * @returns A boolean indicating whether the given provider is a multicall-enabled provider.
   */
  public static isMulticallProvider<T extends BaseProvider>(
    provider: T
  ): provider is MulticallProvider<T> {
    if ((provider as MulticallProvider<T>)._isMulticallProvider) return true;

    return false;
  }

  /**
   * Wraps a given ethers provider to enable automatic call batching.
   * @param provider The underlying provider to use to batch calls.
   * @param delay The delay (in milliseconds) to wait before performing the ongoing batch of calls. Defaults to 16ms.
   * @param maxMulticallDataLength The maximum total calldata length allowed in a multicall batch, to avoid having the RPC backend to revert because of too large (or too long) request. Set to 0 to disable this behavior. Defaults to 200k.
   * @returns The multicall provider, which is a proxy to the given provider, automatically batching any call performed with it.
   */
  public static wrap<T extends BaseProvider>(
    provider: T,
    delay = 16,
    maxMulticallDataLength = 200_000
  ): MulticallProvider<T> {
    if (MulticallWrapper.isMulticallProvider(provider)) return provider; // Do not overwrap when given provider is already a multicall provider.

    // Overload provider

    Object.defineProperties(provider, {
      _isMulticallProvider: {
        value: true,
        writable: false,
        enumerable: true,
        configurable: false,
      },
      _provider: {
        value: provider,
        writable: false,
        enumerable: true,
        configurable: false,
      },
      maxMulticallDataLength: {
        value: maxMulticallDataLength,
        writable: true,
        enumerable: true,
        configurable: true,
      },
      isMulticallEnabled: {
        value: true,
        writable: true,
        enumerable: true,
        configurable: true,
      },
      multicallDelay: {
        get: function () {
          return this._multicallDelay;
        },
        set: function (delay: number) {
          this._debouncedPerformMulticall?.flush();

          this._multicallDelay = delay;

          this._debouncedPerformMulticall = _debounce(this._performMulticall, delay);
        },
        enumerable: true,
        configurable: false,
      },
    });

    const multicallProvider = provider as MulticallProvider<T>;

    // Define execution context

    const multicall2 = Multicall2__factory.connect(multicall2Address, provider);
    const multicall3 = Multicall3__factory.connect(multicall3Address, provider);

    let queuedCalls: ContractCall[] = [];

    multicallProvider._performMulticall = async function () {
      const _queuedCalls = [...queuedCalls];

      if (queuedCalls.length === 0) return;

      queuedCalls = [];

      const blockTagCalls = _queuedCalls.reduce((acc, queuedCall) => {
        const blockTag = queuedCall.blockTag.toString();

        return {
          ...acc,
          [blockTag]: [queuedCall].concat(acc[blockTag] ?? []),
        };
      }, {} as { [blockTag: BlockTag]: ContractCall[] });

      await Promise.all(
        Object.values(blockTagCalls).map(async (blockTagQueuedCalls) => {
          const callStructs = blockTagQueuedCalls.map(({ to, data }) => ({
            target: to,
            callData: data,
          }));

          // Split call in parts of max length to avoid too-long requests

          let currentLength = 0;
          const calls: (typeof callStructs)[] = [[]];

          callStructs.forEach((callStruct) => {
            const newLength = currentLength + callStruct.callData.length;

            if (this.maxMulticallDataLength > 0 && newLength > this.maxMulticallDataLength) {
              currentLength = callStruct.callData.length;
              calls.push([]);
            } else currentLength = newLength;

            calls[calls.length - 1].push(callStruct);
          });

          const { blockTag, multicallVersion } = blockTagQueuedCalls[0];
          const multicall = multicallVersion === MulticallVersion.V2 ? multicall2 : multicall3;

          try {
            const res = (
              await Promise.all(
                calls.map((call) => multicall.callStatic.tryAggregate(false, call, { blockTag }))
              )
            ).flat();

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

    // Overload multicall provider delay

    multicallProvider.multicallDelay = delay;

    // Overload `BaseProvider.perform`

    const _perform = provider.perform.bind(provider);

    multicallProvider.perform = async function (method: string, params: any): Promise<string> {
      if (method !== "call" || !this.isMulticallEnabled) return _perform(method, params);

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

      this._debouncedPerformMulticall();

      return new Promise<string>((resolve, reject) => {
        queuedCalls.push({
          to,
          data,
          blockTag,
          multicallVersion,
          resolve,
          reject,
        });
      });
    };

    return multicallProvider;
  }
}

export default MulticallWrapper;
