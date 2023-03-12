import * as dotenv from "dotenv";
import { ethers } from "ethers";
import _range from "lodash/range";

import { JsonRpcProvider, WebSocketProvider } from "@ethersproject/providers";

import { MulticallProvider } from "../src";
import { multicall3Address, multicall2Address } from "../src/constants";

import UniAbi from "./abis/Uni.json";

dotenv.config();

const wsRpcUrl = process.env.WS_RPC_URL;
const httpRpcUrl = process.env.HTTP_RPC_URL;

if (!wsRpcUrl) throw Error(`Missing environment variable WS_RPC_URL`);
if (!httpRpcUrl) throw Error(`Missing environment variable HTTP_RPC_URL`);

const uniAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
const unknownAddress = "0xd6409e50c05879c5B9E091EB01E9Dd776d00A151";

describe("ethers-multicall-provider", () => {
  let provider: JsonRpcProvider;

  beforeEach(async () => {
    provider = new JsonRpcProvider(httpRpcUrl);

    await provider.ready;

    const send = provider.send.bind(provider);
    jest
      .spyOn(provider, "send")
      .mockImplementation(async (method, ...args) => send(method, ...args));
  });

  describe("Providers API", () => {
    it("should set delay", () => {
      const multicallProvider = MulticallProvider.wrap(provider);

      const newDelay = multicallProvider.multicallDelay + 1;

      multicallProvider.multicallDelay = newDelay;

      expect(multicallProvider._multicallDelay === newDelay);
      expect(multicallProvider.multicallDelay === newDelay);
    });

    it("should set maxMulticallDataLength", () => {
      const multicallProvider = MulticallProvider.wrap(provider);

      const newMaxMulticallDataLength = multicallProvider.maxMulticallDataLength + 1;

      multicallProvider.maxMulticallDataLength = newMaxMulticallDataLength;

      expect(multicallProvider.maxMulticallDataLength === newMaxMulticallDataLength);
    });

    it("should have properties shallow cloned", () => {
      const multicallProvider = MulticallProvider.wrap(provider);

      expect(multicallProvider.network === provider.network);
    });

    it("should propagate getters & setters", () => {
      const multicallProvider = MulticallProvider.wrap(provider);

      multicallProvider.pollingInterval = provider.pollingInterval + 1;

      expect(multicallProvider.pollingInterval === provider.pollingInterval);

      provider.pollingInterval = provider.pollingInterval + 1;

      expect(multicallProvider.pollingInterval === provider.pollingInterval);
    });

    it("should getBlockNumber with http", async () => {
      const multicallProvider = MulticallProvider.wrap(provider);

      const [actualBlockNumber, expectedBlockNumber] = await Promise.all([
        multicallProvider.getBlockNumber(),
        provider.getBlockNumber(),
      ]);

      expect(actualBlockNumber).toEqual(expectedBlockNumber);
    });

    it("should getBlockNumber with websocket", async () => {
      const wsProvider = new WebSocketProvider(wsRpcUrl);
      const multicallProvider = MulticallProvider.wrap(wsProvider);

      const [actualBlockNumber, expectedBlockNumber] = await Promise.all([
        multicallProvider.getBlockNumber(),
        wsProvider.getBlockNumber(),
      ]);

      expect(actualBlockNumber).toEqual(expectedBlockNumber);

      return wsProvider._websocket.terminate();
    });
  });

  describe("Calls batching", () => {
    let multicallProvider: JsonRpcProvider;
    let signer: ethers.Signer;

    let uni: ethers.Contract;
    let unknownUni: ethers.Contract;

    beforeEach(() => {
      multicallProvider = MulticallProvider.wrap(provider);
      signer = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, multicallProvider);

      uni = new ethers.Contract(uniAddress, UniAbi, signer);
      unknownUni = new ethers.Contract(unknownAddress, UniAbi, signer);
    });

    it("should batch UNI calls inside Promise.all", async () => {
      const result = await Promise.all([uni.name(), uni.symbol(), uni.decimals()]);

      expect(result).toEqual(["Uniswap", "UNI", 18]);
      expect(provider.send).toHaveBeenCalledTimes(3);
      expect(provider.send).toHaveBeenNthCalledWith(1, "eth_chainId", []);
      expect(provider.send).toHaveBeenNthCalledWith(2, "eth_chainId", []);
      expect(provider.send).toHaveBeenNthCalledWith(3, "eth_call", [
        {
          data: "0xbce38bd7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001600000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f98400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004313ce567000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000495d89b41000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000406fdde0300000000000000000000000000000000000000000000000000000000",
          to: "0xca11bde05977b3631167028862be2a173976ca11",
        },
        "latest",
      ]);
    });

    it("should batch UNI calls without Promise.all", async () => {
      expect(uni.name()).resolves.toEqual("Uniswap");
      expect(uni.symbol()).resolves.toEqual("UNI");
      expect(await uni.decimals()).toEqual(18);

      expect(provider.send).toHaveBeenCalledTimes(3);
      expect(provider.send).toHaveBeenNthCalledWith(1, "eth_chainId", []);
      expect(provider.send).toHaveBeenNthCalledWith(2, "eth_chainId", []);
      expect(provider.send).toHaveBeenNthCalledWith(3, "eth_call", [
        {
          data: "0xbce38bd7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001600000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f98400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004313ce567000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000495d89b41000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000406fdde0300000000000000000000000000000000000000000000000000000000",
          to: multicall3Address.toLowerCase(),
        },
        "latest",
      ]);
    });

    it("should batch calls using Multicall2 at block 14_000_000", async () => {
      const overrides = { blockTag: 14_000_000 };

      const result = await Promise.all([
        uni.name(overrides),
        uni.symbol(overrides),
        uni.decimals(overrides),
      ]);

      expect(result).toEqual(["Uniswap", "UNI", 18]);
      expect(provider.send).toHaveBeenCalledTimes(3);
      expect(provider.send).toHaveBeenNthCalledWith(1, "eth_chainId", []);
      expect(provider.send).toHaveBeenNthCalledWith(2, "eth_chainId", []);
      expect(provider.send).toHaveBeenNthCalledWith(3, "eth_call", [
        {
          data: "0xbce38bd7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001600000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f98400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004313ce567000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000495d89b41000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000406fdde0300000000000000000000000000000000000000000000000000000000",
          to: multicall2Address.toLowerCase(),
        },
        "0xd59f80",
      ]);
    });

    it("should not batch calls at block 12_000_000", async () => {
      const overrides = { blockTag: 12_000_000 };

      const result = await Promise.all([
        uni.name(overrides),
        uni.symbol(overrides),
        uni.decimals(overrides),
      ]);

      expect(result).toEqual(["Uniswap", "UNI", 18]);
      expect(provider.send).toHaveBeenCalledTimes(4);
      expect(provider.send).toHaveBeenNthCalledWith(1, "eth_chainId", []);
    });

    it("should not batch calls at earliest block", async () => {
      const overrides = { blockTag: "earliest" };

      const result = await Promise.all([
        uni.name(overrides).catch(() => "Uniswap"),
        uni.symbol(overrides).catch(() => "UNI"),
        uni.decimals(overrides).catch(() => 18),
      ]);

      expect(result).toEqual(["Uniswap", "UNI", 18]);
      expect(provider.send).toHaveBeenCalledTimes(4);
      expect(provider.send).toHaveBeenNthCalledWith(1, "eth_chainId", []);
    });

    it("should throw a descriptive Error when querying unknown contract", async () => {
      await expect(unknownUni.symbol()).rejects.toEqual(
        new Error(
          `call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="symbol()", data="0x", errorArgs=null, errorName=null, errorSignature=null, reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)`
        )
      );
    });

    it("should query filters", async () => {
      const events = await uni.queryFilter(uni.filters.Transfer(), 14_000_000, 14_002_000);

      expect(events).toHaveLength(269);
    });

    it("should only fail the failing call promise when querying incorrect contract", async () => {
      expect(uni.symbol()).resolves.toEqual("UNI");
      expect(unknownUni.symbol().catch(() => "UNI")).resolves.toEqual("UNI");
      await expect(unknownUni.symbol()).rejects.toEqual(
        new Error(
          `call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="symbol()", data="0x", errorArgs=null, errorName=null, errorSignature=null, reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)`
        )
      );
    });

    it("should only fail the failing call promise when querying before multicall deployment", async () => {
      const overrides = { blockTag: 14_000_000 };

      expect(uni.symbol()).resolves.toBe("UNI");
      expect(uni.symbol(overrides).catch(() => "UNI")).resolves.toEqual("UNI");
      await expect(unknownUni.symbol(overrides)).rejects.toEqual(
        new Error(
          `call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="symbol()", data="0x", errorArgs=null, errorName=null, errorSignature=null, reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)`
        )
      );
    });

    it("should handle spaced loads", async () => {
      const range = _range(2_000);
      const result = await Promise.all(
        range.map(async () => {
          await new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * 3_000)));

          return uni.symbol();
        })
      );

      expect(result).toEqual(range.map(() => "UNI"));
    });

    it("should handle large loads", async () => {
      const range = _range(10_000);
      const result = await Promise.all(range.map(() => uni.balanceOf(multicall3Address)));

      expect(result.map((balance) => balance.toString())).toEqual(range.map(() => "0"));
    });
  });
});
