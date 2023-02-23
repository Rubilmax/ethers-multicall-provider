import { isHexString } from "ethers/lib/utils";

import { BlockTag } from "@ethersproject/providers";

import { multicall2DeploymentBlockNumbers, multicall3DeploymentBlockNumbers } from "./constants";
import { MulticallVersion } from "./multicall-provider";

export const getBlockNumber = (blockTag: BlockTag) => {
  if (isHexString(blockTag)) return parseInt(blockTag as string, 16);
  else if (typeof blockTag === "number") return blockTag;
  else if (blockTag === "earliest") return 0;

  return null;
};

export const getMulticallVersion = (blockNumber: number | null, chainId: number) => {
  if (blockNumber != null) {
    if (blockNumber <= (multicall3DeploymentBlockNumbers[chainId] ?? Infinity)) {
      if (blockNumber <= (multicall2DeploymentBlockNumbers[chainId] ?? Infinity)) return null;

      return MulticallVersion.V2;
    }
  }

  return MulticallVersion.V3;
};
