import * as dotenv from "dotenv";
import { ethers } from "ethers";

import { MulticallProvider } from "../src";

import UniAbi from "./abis/Uni.json";

dotenv.config();

const httpRpcUrl = process.env.HTTP_RPC_URL || "https://rpc.ankr.com/eth";

describe("ethers-multicall-provider", () => {
  let rawRpcProvider: ethers.providers.JsonRpcProvider;
  let rpcProvider: ethers.providers.JsonRpcProvider;
  let signer: ethers.Signer;

  let uni: ethers.Contract;

  beforeEach(() => {
    rawRpcProvider = new ethers.providers.JsonRpcProvider(httpRpcUrl, 1);
    rpcProvider = MulticallProvider.wrap(rawRpcProvider);
    signer = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, rpcProvider);

    uni = new ethers.Contract("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", UniAbi, signer);
  });

  describe("Providers integration", () => {
    it("should work given a JsonRpcProvider", async () => {
      expect(await uni.symbol()).toBe("UNI");
    });

    it("should work given a JsonRpcBatchProvider", async () => {
      rawRpcProvider = new ethers.providers.JsonRpcBatchProvider(httpRpcUrl, 1);
      rpcProvider = MulticallProvider.wrap(rawRpcProvider);

      expect(await uni.connect(rpcProvider).symbol()).toBe("UNI");
    });
  });

  describe("Calls batching", () => {
    it("should batch UNI calls inside Promise.all", async () => {
      const send = rawRpcProvider.send.bind(rawRpcProvider);

      jest
        .spyOn(rawRpcProvider, "send")
        .mockImplementation(async (method, ...args) => send(method, ...args));

      await Promise.all([uni.name(), uni.symbol(), uni.decimals()]).then(
        ([name, symbol, decimals]: [string, string, ethers.BigNumber]) => {
          expect(name).toBe("Uniswap");
          expect(symbol).toBe("UNI");
          expect(decimals.toString()).toBe("18");
        }
      );

      expect(rawRpcProvider.send).toBeCalledTimes(2);
      expect(rawRpcProvider.send).toBeCalledWith("eth_chainId", []);
      expect(rawRpcProvider.send).toBeCalledWith("eth_call", [
        {
          data: "0xbce38bd7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001600000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f98400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004313ce567000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000495d89b41000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000406fdde0300000000000000000000000000000000000000000000000000000000",
          to: "0xca11bde05977b3631167028862be2a173976ca11",
        },
        "latest",
      ]);
    });

    it("should batch UNI calls without Promise.all", async () => {
      const send = rawRpcProvider.send.bind(rawRpcProvider);

      jest
        .spyOn(rawRpcProvider, "send")
        .mockImplementation(async (method, ...args) => send(method, ...args));

      uni.name().then((name: string) => expect(name).toBe("Uniswap"));
      uni.symbol().then((symbol: string) => expect(symbol).toBe("UNI"));
      await uni
        .decimals()
        .then((decimals: ethers.BigNumber) => expect(decimals.toString()).toBe("18"));

      expect(rawRpcProvider.send).toBeCalledTimes(2);
      expect(rawRpcProvider.send).toBeCalledWith("eth_chainId", []);
      expect(rawRpcProvider.send).toBeCalledWith("eth_call", [
        {
          data: "0xbce38bd7000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001600000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f98400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000004313ce567000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000495d89b41000000000000000000000000000000000000000000000000000000000000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f9840000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000000406fdde0300000000000000000000000000000000000000000000000000000000",
          to: "0xca11bde05977b3631167028862be2a173976ca11",
        },
        "latest",
      ]);
    });

    it("should fetch UNI.balanceOf(cUNI) at block 14_500_000", async () => {
      const balance = await uni.balanceOf("0x35A18000230DA775CAc24873d00Ff85BccdeD550", {
        blockTag: 14_500_000,
      });

      expect(balance.toString()).toEqual("9765621447608616146796922");
    });

    it("should throw a descriptive Error when querying unknown contract", async () => {
      const unknown = new ethers.Contract(
        "0xd6409e50c05879c5B9E091EB01E9Dd776d00A151",
        UniAbi,
        signer
      );

      expect(unknown.symbol()).rejects.toThrow(
        new Error(
          `call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="symbol()", data="0x", errorArgs=null, errorName=null, errorSignature=null, reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)`
        )
      );
    });

    it("should query filters", async () => {
      const events = await uni.queryFilter(uni.filters.Transfer(), 14_000_000, 14_002_000);

      expect(events).toHaveLength(269);
    });

    // it("should only fail the failing call promise when querying incorrect contract", async () => {
    //   const unknown = new ethers.Contract(
    //     "0xd6409e50c05879c5B9E091EB01E9Dd776d00A151",
    //     UniAbi,
    //     signer
    //   );

    //   expect(uni.symbol()).resolves.toBe("UNI");
    //   expect(unknown.symbol()).rejects.toThrow(
    //     "0xd6409e50c05879c5B9E091EB01E9Dd776d00A151:symbol() empty return data exception"
    //   );
    //   expect(await unknown.symbol().catch(() => "DEFAULT")).toBe("DEFAULT");
    // });

    // it("should only fail the failing call promise when querying before multicall deployment", async () => {
    //   expect(uni.symbol({ blockTag: 14_500_000 })).resolves.toBe("UNI");
    //   expect(uni.symbol({ blockTag: 14_000_000 })).rejects.toThrow(
    //     'call revert exception [ See: https://links.ethers.org/v5-errors-CALL_EXCEPTION ] (method="tryAggregate(bool,(address,bytes)[])", data="0x", errorArgs=null, errorName=null, errorSignature=null, reason=null, code=CALL_EXCEPTION, version=abi/5.7.0)'
    //   );
    //   expect(await uni.symbol({ blockTag: 14_000_000 }).catch(() => "UNI")).toBe("UNI");
    // });
  });
});
