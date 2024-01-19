import DataLoader from "dataloader";
import {
  BlockTag,
  BytesLike,
  AbstractProvider,
  PerformActionRequest,
  Network,
  isHexString,
} from "ethers";

import { multicallAddresses } from "./constants";
import { Multicall2, Multicall3 } from "./types";
import { getBlockNumber, getMulticall } from "./utils";

export interface ContractCall {
  to: string;
  data: string;
  blockTag: BlockTag;
}

export interface ContractCallRequest {
  call: ContractCall;
  multicall: Multicall2 | Multicall3;
}

export type MulticallProvider<T extends AbstractProvider = AbstractProvider> = T & {
  readonly _isMulticallProvider: boolean;

  fetchNetwork(): Promise<Network>;
  _networkPromise: Promise<Network>;

  maxMulticallDataLength: number;
  isMulticallEnabled: boolean;
};

export class MulticallWrapper {
  /**
   * Returns whether a given provider is a multicall-enabled provider.
   * @param provider The provider to check.
   * @returns A boolean indicating whether the given provider is a multicall-enabled provider.
   */
  public static isMulticallProvider<T extends AbstractProvider>(
    provider: T
  ): provider is MulticallProvider<T> {
    if ((provider as MulticallProvider<T>)._isMulticallProvider) return true;

    return false;
  }

  /**
   * Wraps a given ethers provider to enable automatic call batching.
   * @param provider The underlying provider to use to batch calls.
   * @param maxMulticallDataLength The maximum total calldata length allowed in a multicall batch, to avoid having the RPC backend to revert because of too large (or too long) request. Set to 0 to disable this behavior. Defaults to 0. Typically 480k for Alchemy.
   * @returns The multicall provider, which is a proxy to the given provider, automatically batching any call performed with it.
   */
  public static wrap<T extends AbstractProvider>(
    provider: T,
    maxMulticallDataLength = 0,
    cache = true
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
    });

    const multicallProvider = provider as MulticallProvider<T>;

    // Define execution context

    const dataLoader = new DataLoader<ContractCallRequest, any, string>(
      async function (reqs) {
        const blockTagReqs: { [blockTag: string]: (ContractCallRequest & { index: number })[] } =
          {};

        reqs.forEach(({ call, multicall }, index) => {
          const blockTag = call.blockTag.toString();

          if (!blockTagReqs[blockTag]) blockTagReqs[blockTag] = [];

          blockTagReqs[blockTag].push({ call, multicall, index });
        });

        const results = new Array(reqs.length);

        await Promise.all(
          Object.values(blockTagReqs).map(async (blockTagReqs) => {
            const callStructs = blockTagReqs.map(({ call }) => ({
              target: call.to,
              callData: call.data,
            }));

            // Split call in parts of max length to avoid too-long requests

            let currentLength = 0;
            const calls: (typeof callStructs)[] = [];

            if (multicallProvider.maxMulticallDataLength > 0) {
              calls.push([]);

              callStructs.forEach((callStruct) => {
                const newLength = currentLength + callStruct.callData.length;

                if (newLength > multicallProvider.maxMulticallDataLength) {
                  currentLength = callStruct.callData.length;
                  calls.push([]);
                } else currentLength = newLength;

                calls[calls.length - 1].push(callStruct);
              });
            } else calls.push(callStructs);

            const {
              call: { blockTag },
              multicall,
            } = blockTagReqs[0];

            try {
              const res = (
                await Promise.all(
                  calls.map((call) => multicall.tryAggregate.staticCall(false, call, { blockTag }))
                )
              ).flat();

              if (res.length !== callStructs.length)
                throw new Error(
                  `Unexpected multicall response length: received ${res.length}; expected ${callStructs.length}`
                );

              blockTagReqs.forEach(({ index }, i) => {
                results[index] = res[i].returnData;
              });
            } catch (error: any) {
              blockTagReqs.forEach(({ index }) => {
                results[index] = error;
              });
            }
          })
        );

        return results;
      },
      {
        cache,
        cacheKeyFn: ({ call }) => (call.to + call.data + call.blockTag.toString()).toLowerCase(),
      }
    );

    // Expose `Provider.fetchNetwork` to fetch & update the network cache when needed

    const getNetwork = provider.getNetwork.bind(provider);

    multicallProvider.fetchNetwork = async function fetchNetwork(): Promise<Network> {
      this._networkPromise = getNetwork();

      return this._networkPromise;
    };

    multicallProvider.fetchNetwork();

    // Overload `Provider._detectNetwork` to disable polling the network at each RPC call

    multicallProvider._detectNetwork = async function _detectNetwork(): Promise<Network> {
      return this._networkPromise;
    };

    // Overload `Provider._perform`

    const _perform = provider._perform.bind(provider);

    multicallProvider._perform = async function (req: PerformActionRequest): Promise<any> {
      if (req.method !== "call" || !this.isMulticallEnabled) return _perform(req);

      const {
        transaction: { to, data },
        blockTag,
      } = req;

      if (!to || !data || multicallAddresses.has(to.toString().toLowerCase())) return _perform(req);

      const network = await this._networkPromise;

      const blockNumber = getBlockNumber(blockTag);
      const multicall = getMulticall(blockNumber, Number(network.chainId), provider);

      if (multicall == null) return _perform(req);

      const request = {
        call: { to, data, blockTag },
        multicall,
      };

      return dataLoader.load(request).then((value) => {
        if (blockNumber == null) dataLoader.clear(request);

        return value;
      });
    };

    return multicallProvider;
  }
}

export default MulticallWrapper;
