## how to
1. [optional] follow quickstart in [faremeter's repo](https://github.com/faremeter/faremeter/blob/ce13cb645047e8a64ce6942c48dd4b3da8f448d0/QUICKSTART.md) to have the facilitator running locally or use facilitator url for this example (`https://facilitator.corbits.dev`)
2. Generate keypairs for the example
  ```
  mkdir keypairs
  ```
  ```
  solana-keygen new --no-bip39-passphrase -o keypairs/payer.json
  solana-keygen new --no-bip39-passphrase -o keypairs/payto.json
  ```
3. setup your `.env` according to the `.env.example`
4. fund your generated accounts with SOL and USDC. Use solana and circle faucet
  - solana faucet: https://faucet.solana.com
  - circle faucet: https://faucet.circle.com
5. Install deps:
  ```
  $ npm i
  ```

6. Build:
  ```
  $ npm run build
  ```
7. start the server:
  ```
  $ npm run start:server
  ```
8. start test script:
  ```
  $ npm run start:test
  ```