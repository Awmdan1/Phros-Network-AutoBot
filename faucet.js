const fs = require('fs');
const axios = require('axios');
const { ethers } = require('ethers');

const API_URL = 'https://testnet-router.zenithswap.xyz/api/v1/faucet';
const TOKEN_ADDRESS = '0xAD902CF99C2dE2f1Ba5ec4D642Fd7E49cae9EE37';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const privKeys = fs.readFileSync('key.txt', 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (let i = 0; i < privKeys.length; i++) {
    const privKey = privKeys[i];
    let address;
    try {
      address = new ethers.Wallet(privKey).address;
    } catch (e) {
      console.error(`Invalid private key at line ${i + 1}: ${privKey}`);
      continue;
    }
    let retry = 0;
    while (true) {
      try {
        const res = await axios.post(API_URL, {
          tokenAddress: TOKEN_ADDRESS,
          userAddress: address
        }, {
          headers: {
            'accept': '*/*',
            'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'content-type': 'application/json',
            'priority': 'u=1, i',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'Referer': 'https://testnet.zenithswap.xyz/'
          }
        });
        if (res.data && res.data.status === 400 && res.data.message === 'system error') {
          retry++;
          if (retry > 5) {
            console.error(`[${i + 1}/${privKeys.length}] ${address}: system error, exceeded max retries (5)`);
            break;
          }
          console.log(`[${i + 1}/${privKeys.length}] ${address}: system error, retrying (${retry})...`);
          await delay(2000);
          continue;
        }
        if (res.data && res.data.msg) {
          console.log(`[${i + 1}/${privKeys.length}] ${address}: ${res.data.msg}${retry > 0 ? ` (retries: ${retry})` : ''}`);
        } else {
          console.log(`[${i + 1}/${privKeys.length}] ${address}:`, res.data, retry > 0 ? `(retries: ${retry})` : '');
        }
        break;
      } catch (err) {
        if (err.response && err.response.data) {
          const d = err.response.data;
          if (d.status === 400 && d.message === 'system error') {
            retry++;
            if (retry > 5) {
              console.error(`[${i + 1}/${privKeys.length}] ${address}: system error, exceeded max retries (5)`);
              break;
            }
            console.log(`[${i + 1}/${privKeys.length}] ${address}: system error, retrying (${retry})...`);
            await delay(2000);
            continue;
          }
          if (d.msg) {
            console.error(`[${i + 1}/${privKeys.length}] ${address}: ${d.msg}${retry > 0 ? ` (retries: ${retry})` : ''}`);
          } else {
            console.error(`[${i + 1}/${privKeys.length}] ${address}:`, d, retry > 0 ? `(retries: ${retry})` : '');
          }
        } else {
          console.error(`[${i + 1}/${privKeys.length}] ${address}: Error`, err.message, retry > 0 ? `(retries: ${retry})` : '');
        }
        break;
      }
    }
    if (i < privKeys.length - 1) await delay(5000);
  }
}

main();
