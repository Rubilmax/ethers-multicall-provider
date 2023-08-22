import { Signer } from "ethers";
import { isHexString } from "ethers/lib/utils";

import { BlockTag, Provider } from "@ethersproject/providers";

import {
  multicall2Address,
  multicall2DeploymentBlockNumbers,
  multicall3Address,
  multicall3ChainAddress,
  multicall3DeploymentBlockNumbers,
} from "./constants";
import { AbstractProvider } from "./multicall-provider";
import { Multicall2__factory, Multicall3__factory } from "./types";

export const getBlockNumber = (blockTag: BlockTag) => {
  if (isHexString(blockTag)) return parseInt(blockTag as string, 16);
  else if (typeof blockTag === "number") return blockTag;
  else if (blockTag === "earliest") return 0;

  return null;
};

export const getMulticall = (
  blockNumber: number | null,
  chainId: number,
  provider: Signer | Provider
) => {
  if (blockNumber != null) {
    if (blockNumber <= (multicall3DeploymentBlockNumbers[chainId] ?? Infinity)) {
      if (blockNumber <= (multicall2DeploymentBlockNumbers[chainId] ?? Infinity)) return null;

      return Multicall2__factory.connect(multicall2Address, provider);
    }
  }

  return Multicall3__factory.connect(
    multicall3ChainAddress[chainId] || multicall3Address,
    provider
  );
};

export const isAbstractProvider = (provider: Provider): provider is AbstractProvider => {
  const candidate = provider as AbstractProvider;

  return candidate._isProvider && !!candidate.network && !!candidate.perform;
};
