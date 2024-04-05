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
- Natively supports 25+ EVM-compatible chains on which Multicall3 & Multicall2 are deployed
- Enables 10x faster off-chain data queries, making UIs faster to render and reload
- Built-in support for blockTag-specific contract calls, batching all calls made at the same block tag (if applicable)
- Only fails specific failing smart contract calls when batching, which makes debugging as easy as with native ethers

### `ethers-multicall-provider` is a drop-in solution batching ALL smart contract calls!

```diff
-  const provider = getDefaultProvider("...");
+  const provider = MulticallWrapper.wrap(getDefaultProvider("..."));
```

---

## Installation

### Using ethers-v6

> [!WARNING]  
> Ethers made changes to their `Provider` & `Signer` classes throughout v6, that are breaking types. For versions `v6.7` to `v6.10`, use `ethers-multicall-provider@6.2.0`. For later versions, use `ethers-multicall-provider@6.3.0`.

```bash
npm install ethers-multicall-provider
```

```bash
yarn add ethers-multicall-provider
```

### Using ethers-v5

> [!WARNING]  
> This version is deprecated and probably is not as efficient as with v6.

```bash
npm install ethers-multicall-provider@3.1.2
```

```bash
yarn add ethers-multicall-provider@3.1.2
```

---

## Usage

Wrap any ethers provider using `MulticallWrapper.wrap` and use the wrapped provider anywhere you want to batch calls!

```typescript
import { ethers } from "ethers";
import { MulticallWrapper } from "ethers-multicall-provider";

const provider = MulticallWrapper.wrap(getDefaultProvider("..."));

MulticallWrapper.isMulticallProvider(provider); // Returns true, only useful for type safety.

let uni = new ethers.Contract("0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", UniAbi, provider);

// Calls performed simultaneously are automatically batched when using the multicall provider.
Promise.all([
  uni.name(),
  uni.symbol(),
  uni.decimals(),
  uni.inexistantFunction().catch(() => "default value"),
]).then(console.log);

// When batching calls is no longer expected, just disable it.
provider.isMulticallEnabled = false;

// Calls performed simultaneously will still perform 2 separate on-chain calls.
Promise.all([uni.name(), uni.symbol()]).then(console.log);
```

## Limits

### `msg.sender` override

Because calls are batched through the Multicall contract, all calls will inherently have the Multicall contract as `msg.sender`. This has no impact on most queries, because most of the time `msg.sender` is not used in view functions ; but it may introduce unexpected behaviors in specific smart contracts.

To circumvent this, just use the default ethers provider in places where you don't want `msg.sender` to be overriden.

### Network cache

Starting from `ethers-v6`, network is no longer cached in the provider, so that each RPC call first requests the network and updates the provider consequently. Using `ethers-multicall-provider`, the first network the provider is connected to is cached and can only be changed by calling `fetchNetwork()`.

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
