# ethers-multicall-provider

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

> ⚡🚀 Call any set of functions from any set of smart contracts in a single RPC query, seamlessly using ethers' providers API!

Querying an RPC endpoint can be very costly (**100+ queries**) when loading data from multiple smart contracts.
With multicall, batch these queries into a single, on-chain query, without additional over-head!

- Integrates both Multicall2 & Multicall3, enabling faster queries up to block #12_336_033 on mainnet
- Natively supports 25+ EVM-compatible chains on which Multicall3 is deployed
- Enable 10x faster off-chain data queries, making UIs faster to render and reload
- Only fails specific failing smart contract calls when batching, which makes debugging as easy as with native ethers

### `ethers-multicall-provider` is a drop-in solution batching ALL smart contract calls!

```diff
const provider = getDefaultProvider("...");
+  const multicallProvider = MulticallProvider.wrap(provider);

const contract = new ethers.Contract(
  address,
  SomeAbi,
-  provider
+  multicallProvider
);
```

---

## Installation

```bash
npm install ethers-multicall-provider
```

```bash
yarn add ethers-multicall-provider
```

---

## Usage

Wrap any ethers provider using `MulticallProvider.wrap` and use the wrapped provider anywhere you want to batch calls!

```typescript
import { ethers } from "ethers";
import { MulticallProvider } from "ethers-multicall-provider";

const provider = getDefaultProvider("...");
const multicallProvider = MulticallProvider.wrap(provider);

let uni = new ethers.Contract(
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  UniAbi,
  multicallProvider
);

// Calls performed simultaneously are automatically batched when using the multicall provider.
Promise.all([
  uni.name(),
  uni.symbol(),
  uni.decimals(),
  uni.inexistantFunction().catch(() => "default value"),
]).then(console.log);

// When batching calls is no longer expected, just connect using the default ethers provider.
uni = uni.connect(provider);

// Calls performed simultaneously will still perform 2 separate on-chain calls.
Promise.all([uni.name(), uni.symbol()]).then(console.log);
```

## Limits

Because calls are batched through the Multicall contract, all calls will have the Multicall contract as `msg.sender`. It may introduce unexpected behaviors.
To circumvent this, just use the default ethers provider in places where you don't want `msg.sender` to be overriden.

[build-img]: https://github.com/rubilmax/ethers-multicall-provider/actions/workflows/release.yml/badge.svg
[build-url]: https://github.com/rubilmax/ethers-multicall-provider/actions/workflows/release.yml
[downloads-img]: https://img.shields.io/npm/dt/ethers-multicall-provider
[downloads-url]: https://www.npmtrends.com/ethers-multicall-provider
[npm-img]: https://img.shields.io/npm/v/ethers-multicall-provider
[npm-url]: https://www.npmjs.com/package/ethers-multicall-provider
[issues-img]: https://img.shields.io/github/issues/rubilmax/ethers-multicall-provider
[issues-url]: https://github.com/rubilmax/ethers-multicall-provider/issues
[codecov-img]: https://codecov.io/gh/rubilmax/ethers-multicall-provider/branch/main/graph/badge.svg
[codecov-url]: https://codecov.io/gh/rubilmax/ethers-multicall-provider
[semantic-release-img]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[commitizen-img]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
