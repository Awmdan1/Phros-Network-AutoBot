const fs = require('fs');
const axios = require('axios');
const { ethers } = require('ethers');
const HttpProxyAgent = require('http-proxy-agent');
const HttpsProxyAgent = require('https-proxy-agent');

const LOGIN_URL = 'https://api.pharosnetwork.xyz/user/login';
const FAUCET_URL = 'https://api.pharosnetwork.xyz/faucet/daily?address=';
const MESSAGE = 'pharos';
const RPC_URL = 'https://testnet.dplabs-internal.com';
const SEND_TIMES = 100; // Số lần gửi mỗi ví, có thể chỉnh
const SEND_AMOUNT = '0.0001'; // Số ETH gửi mỗi lần
const VERIFY_TASK_ID_SEND = 103;
const ENABLE_FAUCET = false;
const ENABLE_CHECKIN = false;
const ENABLE_SEND = true; // Bật/tắt chức năng gửi ETH và verify task


// ANSI color helpers
const COLOR_RESET = '\x1b[0m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_RED = '\x1b[31m';
const COLOR_YELLOW = '\x1b[33m';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(COLOR_YELLOW + 'Bắt đầu chạy script...' + COLOR_RESET);
  // Đọc danh sách proxy
  let proxies = [];
  try {
    proxies = fs.readFileSync('proxy.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    console.log(COLOR_YELLOW + `Đã đọc proxy.txt, số proxy: ${proxies.length}` + COLOR_RESET);
  } catch (e) {
    proxies = [];
    console.error(COLOR_RED + 'Lỗi khi đọc proxy.txt: ' + e.message + COLOR_RESET);
  }
  const useProxy = proxies.length > 0;

  let privKeys = [];
  try {
    privKeys = fs.readFileSync('key.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    console.log(COLOR_YELLOW + `Đã đọc key.txt, số ví: ${privKeys.length}` + COLOR_RESET);
  } catch (e) {
    console.error(COLOR_RED + 'Lỗi khi đọc key.txt: ' + e.message + COLOR_RESET);
    privKeys = [];
  }
  if (privKeys.length === 0) {
    console.error(COLOR_RED + 'Không tìm thấy private key nào trong file key.txt!' + COLOR_RESET);
    return;
  }

  for (let i = 0; i < privKeys.length; i++) {
    console.log(COLOR_YELLOW + `\n--- Bắt đầu xử lý ví thứ ${i + 1}/${privKeys.length} ---` + COLOR_RESET);
    const privKey = privKeys[i];
    let wallet, address, signature, jwt;
    try {
      wallet = new ethers.Wallet(privKey);
      address = wallet.address;
      signature = await wallet.signMessage(MESSAGE);
      console.log(COLOR_GREEN + `Đã tạo wallet và ký message cho ví: ${address}` + COLOR_RESET);
    } catch (e) {
      console.error(COLOR_RED + `Invalid private key at line ${i + 1}: ${privKey}` + COLOR_RESET);
      continue;
    }
    // LOGIN
    const loginUrl = `${LOGIN_URL}?address=${address}&signature=${signature}&invite_code=eTxumDYUuAbqh218`;
    let logBlock = `[${i + 1}/${privKeys.length}] ${address}:\n`;
    if (useProxy) {
      const proxy = proxies[i % proxies.length];
      logBlock += `  Dùng proxy: ${proxy}\n`;
    } else {
      logBlock += `  Không dùng proxy\n`;
    }
    let loginOK = false;
    // Chọn proxy cho lần này nếu có
    let axiosConfig = {
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
        'authorization': 'Bearer null',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'Referer': 'https://testnet.pharosnetwork.xyz/'
      }
    };
    if (useProxy) {
      const proxy = proxies[i % proxies.length];
      const isHttps = loginUrl.startsWith('https://');
      const agent = isHttps ? new HttpsProxyAgent.HttpsProxyAgent(proxy) : new HttpProxyAgent.HttpProxyAgent(proxy);
      axiosConfig.httpsAgent = agent;
      axiosConfig.httpAgent = agent;
      axiosConfig.proxy = false; // Bắt buộc để axios dùng agent
    }
    console.log(COLOR_YELLOW + 'Bắt đầu login...' + COLOR_RESET);
    try {
      const loginRes = await axios.post(loginUrl, null, axiosConfig);
      if (loginRes.data && loginRes.data.data && loginRes.data.data.jwt) {
        jwt = loginRes.data.data.jwt;
        logBlock += `  ${COLOR_GREEN}Login: OK${COLOR_RESET}\n`;
        loginOK = true;
        console.log(COLOR_GREEN + 'Login thành công!' + COLOR_RESET);
      } else {
        logBlock += `  ${COLOR_RED}Login: response missing jwt ${JSON.stringify(loginRes.data)}${COLOR_RESET}\n`;
        console.error(COLOR_RED + 'Login trả về thiếu jwt: ' + JSON.stringify(loginRes.data) + COLOR_RESET);
      }
    } catch (err) {
      if (err.response) {
        logBlock += `  ${COLOR_RED}Login error: ${JSON.stringify(err.response.data)}${COLOR_RESET}\n`;
        console.error(COLOR_RED + 'Lỗi khi login: ' + JSON.stringify(err.response.data) + COLOR_RESET);
      } else {
        logBlock += `  ${COLOR_RED}Login error: ${err.message}${COLOR_RESET}\n`;
        console.error(COLOR_RED + 'Lỗi khi login: ' + err.message + COLOR_RESET);
      }
    }
    // FAUCET
    if (ENABLE_FAUCET && loginOK) {
      console.log(COLOR_YELLOW + 'Bắt đầu gọi faucet (nếu bật)...' + COLOR_RESET);
      const faucetUrl = FAUCET_URL + address;
      let faucetConfig = {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
          'authorization': `Bearer ${jwt}`,
          'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'Referer': 'https://testnet.pharosnetwork.xyz/'
        }
      };
      if (useProxy) {
        const proxy = proxies[i % proxies.length];
        const isHttps = faucetUrl.startsWith('https://');
        const agent = isHttps ? new HttpsProxyAgent.HttpsProxyAgent(proxy) : new HttpProxyAgent.HttpProxyAgent(proxy);
        faucetConfig.httpsAgent = agent;
        faucetConfig.httpAgent = agent;
        faucetConfig.proxy = false;
      }
      console.log(COLOR_YELLOW + '  Gọi faucet...' + COLOR_RESET);
      try {
        const faucetRes = await axios.post(faucetUrl, null, faucetConfig);
        if (faucetRes.data) {
          if (typeof faucetRes.data === 'object' && faucetRes.data.msg) {
            logBlock += `  ${COLOR_YELLOW}Faucet: ${faucetRes.data.msg}${COLOR_RESET}\n`;
            console.log(COLOR_GREEN + '  Kết quả faucet: ' + faucetRes.data.msg + COLOR_RESET);
          } else {
            logBlock += `  Faucet: ${JSON.stringify(faucetRes.data)}\n`;
            console.log(COLOR_GREEN + '  Kết quả faucet: ' + JSON.stringify(faucetRes.data) + COLOR_RESET);
          }
        } else {
          logBlock += `  Faucet: No response data\n`;
          console.error(COLOR_RED + '  Faucet: No response data' + COLOR_RESET);
        }
      } catch (err) {
        if (err.response) {
          if (err.response.data && err.response.data.msg) {
            logBlock += `  ${COLOR_RED}Faucet error: ${err.response.data.msg}${COLOR_RESET}\n`;
            console.error(COLOR_RED + '  Faucet error: ' + err.response.data.msg + COLOR_RESET);
          } else {
            logBlock += `  ${COLOR_RED}Faucet error: ${JSON.stringify(err.response.data)}${COLOR_RESET}\n`;
            console.error(COLOR_RED + '  Faucet error: ' + JSON.stringify(err.response.data) + COLOR_RESET);
          }
        } else {
          logBlock += `  ${COLOR_RED}Faucet error: ${err.message}${COLOR_RESET}\n`;
          console.error(COLOR_RED + '  Faucet error: ' + err.message + COLOR_RESET);
        }
      }
    }
    // CHECKIN
    if (ENABLE_CHECKIN && loginOK) {
      console.log(COLOR_YELLOW + 'Bắt đầu gọi checkin (nếu bật)...' + COLOR_RESET);
      const checkinUrl = `https://api.pharosnetwork.xyz/sign/in?address=${address}`;
      let checkinConfig = {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
          'authorization': `Bearer ${jwt}`,
          'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'Referer': 'https://testnet.pharosnetwork.xyz/'
        }
      };
      if (useProxy) {
        const proxy = proxies[i % proxies.length];
        const isHttps = checkinUrl.startsWith('https://');
        const agent = isHttps ? new HttpsProxyAgent.HttpsProxyAgent(proxy) : new HttpProxyAgent.HttpProxyAgent(proxy);
        checkinConfig.httpsAgent = agent;
        checkinConfig.httpAgent = agent;
        checkinConfig.proxy = false;
      }
      console.log(COLOR_YELLOW + '  Gọi checkin...' + COLOR_RESET);
      try {
        const checkinRes = await axios.post(checkinUrl, null, checkinConfig);
        if (checkinRes.data) {
          if (typeof checkinRes.data === 'object' && checkinRes.data.msg) {
            logBlock += `  ${COLOR_YELLOW}Checkin: ${checkinRes.data.msg}${COLOR_RESET}\n`;
            console.log(COLOR_GREEN + '  Kết quả checkin: ' + checkinRes.data.msg + COLOR_RESET);
          } else {
            logBlock += `  Checkin: ${JSON.stringify(checkinRes.data)}\n`;
            console.log(COLOR_GREEN + '  Kết quả checkin: ' + JSON.stringify(checkinRes.data) + COLOR_RESET);
          }
        } else {
          logBlock += `  Checkin: No response data\n`;
          console.error(COLOR_RED + '  Checkin: No response data' + COLOR_RESET);
        }
      } catch (err) {
        if (err.response) {
          if (err.response.data && err.response.data.msg) {
            logBlock += `  ${COLOR_RED}Checkin error: ${err.response.data.msg}${COLOR_RESET}\n`;
            console.error(COLOR_RED + '  Checkin error: ' + err.response.data.msg + COLOR_RESET);
          } else {
            logBlock += `  ${COLOR_RED}Checkin error: ${JSON.stringify(err.response.data)}${COLOR_RESET}\n`;
            console.error(COLOR_RED + '  Checkin error: ' + JSON.stringify(err.response.data) + COLOR_RESET);
          }
        } else {
          logBlock += `  ${COLOR_RED}Checkin error: ${err.message}${COLOR_RESET}\n`;
          console.error(COLOR_RED + '  Checkin error: ' + err.message + COLOR_RESET);
        }
      }
    }
    // SAU LOGIN, GỬI ETH VÀ VERIFY TASK
    if (jwt && ENABLE_SEND && loginOK) {
      console.log(COLOR_YELLOW + 'Bắt đầu gửi ETH và verify...' + COLOR_RESET);
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const walletWithProvider = wallet.connect(provider);
      for (let sendIdx = 0; sendIdx < SEND_TIMES; sendIdx++) {
        console.log(COLOR_YELLOW + `  Lần gửi thứ ${sendIdx + 1}/${SEND_TIMES}` + COLOR_RESET);
        try {
          const tx = await walletWithProvider.sendTransaction({
            to: address,
            value: ethers.parseEther(SEND_AMOUNT)
          });
          logBlock += `  Đã gửi ${SEND_AMOUNT} ETH cho chính mình. Đợi xác nhận...\n`;
          console.log(COLOR_YELLOW + '  Đã gửi, chờ xác nhận...' + COLOR_RESET);
          const receipt = await tx.wait();
          if (receipt && receipt.hash) {
            logBlock += `  Tx hash: ${receipt.hash}\n`;
            console.log(COLOR_GREEN + '  Đã xác nhận, tx hash: ' + receipt.hash + COLOR_RESET);
            // Gọi API verify
            const verifyUrl = `https://api.pharosnetwork.xyz/task/verify?address=${address}&task_id=${VERIFY_TASK_ID_SEND}&tx_hash=${receipt.hash}`;
            let verifyConfig = {
              headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
                'authorization': `Bearer ${jwt}`,
                'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'Referer': 'https://testnet.pharosnetwork.xyz/'
              }
            };
            if (useProxy) {
              const proxy = proxies[i % proxies.length];
              const isHttps = verifyUrl.startsWith('https://');
              const agent = isHttps ? new HttpsProxyAgent.HttpsProxyAgent(proxy) : new HttpProxyAgent.HttpProxyAgent(proxy);
              verifyConfig.httpsAgent = agent;
              verifyConfig.httpAgent = agent;
              verifyConfig.proxy = false;
            }
            console.log(COLOR_YELLOW + '  Gọi API verify...' + COLOR_RESET);
            try {
              const verifyRes = await axios.post(verifyUrl, null, verifyConfig);
              if (verifyRes.data) {
                logBlock += `  Xác minh task: ${JSON.stringify(verifyRes.data)}\n`;
                console.log(COLOR_GREEN + '  Kết quả verify: ' + JSON.stringify(verifyRes.data) + COLOR_RESET);
                // Chờ 3-5s sau mỗi lần verify thành công
                const waitMs = Math.floor(Math.random() * 2000) + 3000;
                console.log(COLOR_YELLOW + `  Chờ ${Math.round(waitMs/1000)} giây trước lần gửi tiếp theo...` + COLOR_RESET);
                await delay(waitMs);
              } else {
                logBlock += `  Xác minh task: Không có dữ liệu trả về\n`;
                console.error(COLOR_RED + '  Không có dữ liệu trả về khi verify' + COLOR_RESET);
              }
            } catch (err) {
              if (err.response) {
                logBlock += `  Lỗi xác minh task: ${JSON.stringify(err.response.data)}\n`;
                console.error(COLOR_RED + '  Lỗi khi verify: ' + JSON.stringify(err.response.data) + COLOR_RESET);
              } else {
                logBlock += `  Lỗi xác minh task: ${err.message}\n`;
                console.error(COLOR_RED + '  Lỗi khi verify: ' + err.message + COLOR_RESET);
              }
            }
          } else {
            logBlock += `  Không lấy được tx hash sau khi gửi\n`;
            console.error(COLOR_RED + '  Không lấy được tx hash sau khi gửi' + COLOR_RESET);
          }
        } catch (err) {
          logBlock += `  Lỗi gửi ETH: ${err.message}\n`;
          console.error(COLOR_RED + '  Lỗi gửi ETH: ' + err.message + COLOR_RESET);
        }
      }
    }
    process.stdout.write(logBlock + '\n');
    if (i < privKeys.length - 1) {
      // Random delay từ 5-10s
      const randomDelay = Math.floor(Math.random() * 5000) + 5000;
      console.log(COLOR_YELLOW + `Chờ ${Math.round(randomDelay / 1000)} giây trước khi chuyển sang ví tiếp theo...` + COLOR_RESET);
      await delay(randomDelay);
    }
    if (i === 0) {
      console.error(COLOR_RED + 'Tất cả private key đều bị lỗi, không thực thi được!' + COLOR_RESET);
    }
  }
}

main();
