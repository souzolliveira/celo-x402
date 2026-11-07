# Brief

A morning reading for a marketing team. The accounts they already watch on Instagram, X, LinkedIn, and YouTube are read for the previous day in Brasília. Posts, replies, and a short brief of what was posted and how people reacted are waiting before standup.

The person pays with credits. Credits are USDC on Celo mainnet. Brief spends those credits by paying [buy](https://usebuy.ai/) services over x402: social data from the buy catalog, and a summary from Cencori. The product wallet signs the payments.

Built for the [Agents on Open Rails](https://www.loops.house/agents-on-open-rails) hackathon, on the Build with buy track.

## What a person does

1. Sign in with email through Privy. A Celo smart wallet is created for them.
2. Deposit USDC onchain, then buy credits. The credit transfer goes to the product wallet.
3. Choose the accounts to watch, how many posts from yesterday to read, and whether to include comments and a summary.
4. Run the digest. Each paid call is stored and shown with the brief above the response it read.
5. Issue an API key from Account if another tool should call the same paid proxy.

Pix deposit stores the intention. USDC is credited from the onchain deposit.

## How the money moves

- User transfers that buy credits are sent from their smart wallet. When `CELO_DATA_SUFFIX` is set, Privy appends that suffix to those transactions so the hackathon can attribute them.
- Paid catalog calls use the product wallet in the local buy keychain (`@celo/buy-keystore`). buy settles them as x402 payments on Celo.
- `scripts/register-agent.mjs` registers that product wallet in the ERC-8004 identity registry on Celo mainnet and tags the registration. Run it once for a new wallet. This wallet is already registered.

## Run it locally

Node 20 or newer, Docker, and the [buy](https://usebuy.ai/docs) CLI with the product wallet as the default keychain account.

```sh
cp .env.example .env
docker compose up -d
npm install
npm run dev
```

The app listens on [http://localhost:3001](http://localhost:3001).

| Variable | Role |
| --- | --- |
| `CELO_CHAIN_ID` | `42220` for Celo mainnet |
| `CELO_ATTRIBUTION_TAG` | Tag from `loops project get` |
| `CELO_DATA_SUFFIX` | Calldata suffix for the same tag |
| `AGENT_WALLET_ADDRESS` | Public address of the product wallet |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy app id |
| `PRIVY_APP_SECRET` | Privy server secret |
| `PRIVY_JWT_VERIFICATION_KEY` | Optional JWT verification key |
| `MONGODB_URI` | Mongo connection string |
| `API_KEY_PEPPER` | HMAC pepper for API key hashes |
| `CALL_MAX_USD` | Ceiling for one paid call, in USD. Default `2` |

Copy the values into `.env`. Do not commit that file.

## Next steps

- Credit USDC when a Pix deposit is paid, using the intention the app already stores.
- Run the digest every morning in Brasília, for the previous day, without a person pressing Run now.
- Email the finished brief to the addresses saved on the account.

## Scripts

```sh
npm run dev    # next dev on port 3001
npm run build
npm run start
npm run lint
node scripts/register-agent.mjs
```
