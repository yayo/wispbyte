const http = require('http');
const https = require('https');
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;

const MASK_NAME = 'npm-system-worker';
const sbPath = path.join(__dirname, MASK_NAME);
const sbSize = 68798464;
const sbSHA512 = "710426efc26a503a9729031b9a33c8b4780f3caea64f980ebb89b74d31bf9feae308345687b61cf75f423488aa1be7b0011dbc5b98844905ae917f5ecb5c6fa0";
const etPath = path.join(__dirname, 'easytier-core');
const etSize = 7558408;
const etSHA512 = "ca1f2194d4bb19ae4ba90ab975eb279754e7d14e06947e504a48a3e6b9df8f1e178fc6079022db89deca8229c189cee278d0d3071d521a0ff543c242c6107e72";

const SB_URLS = [
  "https://github.com/SagerNet/sing-box/releases/download/v1.14.0/sing-box-1.14.0-linux-amd64-glibc.tar.gz"
];

const ET_URL = "https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-linux-x86_64-v2.6.4.zip";

// cat config.json | jq --compact-output -r . | sed -e s=\\\\=\\\\\\\\=g -e s/\"/\\\\\"/g -e s/^/\"/ -e s/\$/\"/
const SING_BOX_CONF="config.json";
const SING_BOX_SOCKS_PORT = process.env.SING_BOX_SOCKS_PORT;
const EASYTIER_SOCKS_PORT = process.env.EASYTIER_SOCKS_PORT;
const SING_BOX_VLESS_PORT = process.env.SING_BOX_VLESS_PORT;
const UUID = process.env.UUID;
const WS_PATH = process.env.WS_PATH;
const CONFIG_JSON="{\"log\":{\"level\":\"info\"},\"inbounds\":[{\"tag\":\"socks\",\"type\":\"socks\",\"listen\":\"0.0.0.0\",\"listen_port\":"+SING_BOX_SOCKS_PORT+"},{\"type\":\"vless\",\"tag\":\"vless\",\"listen\":\"127.0.0.1\",\"listen_port\":"+SING_BOX_VLESS_PORT+",\"users\":[{\"uuid\":\""+UUID+"\"}],\"transport\":{\"type\":\"ws\",\"path\":\""+WS_PATH+"\"},\"multiplex\":{\"enabled\":true,\"padding\":false}}],\"outbounds\":[{\"type\":\"direct\",\"tag\":\"direct\",\"bind_interface\":\"eth0\",\"domain_resolver\":\"g_dns\"}],\"route\":{\"default_domain_resolver\":{\"server\":\"g_dns\"},\"rules\":[{\"action\":\"sniff\",\"timeout\":\"1s\"},{\"protocol\":\"dns\",\"action\":\"hijack-dns\"},{\"inbound\":[\"socks\",\"vless\"],\"action\":\"resolve\",\"strategy\":\"ipv4_only\"},{\"inbound\":[\"socks\",\"vless\"],\"outbound\":\"direct\"},{\"action\":\"route\",\"outbound\":\"direct\"}],\"final\":\"direct\"},\"dns\":{\"servers\":[{\"tag\":\"g_dns\",\"type\":\"h3\",\"server\":\"8.8.8.8\",\"server_port\":443,\"path\":\"/dns-query\",\"tls\":{\"enabled\":true,\"disable_sni\":true,\"insecure\":false,\"certificate\":\"-----BEGIN CERTIFICATE-----\\nMIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7wCl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjwTcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0PfyblqAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaHszVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmkMiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70paDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrNVjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQIDAQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibbC5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEeQkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuyh6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM47HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8JZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6EfMgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bbbP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c\\n-----END CERTIFICATE-----\"}}],\"rules\":[{\"inbound\":[\"socks\",\"vless\"],\"server\":\"g_dns\",\"disable_cache\":false}],\"final\":\"g_dns\",\"strategy\":\"ipv4_only\",\"disable_cache\":false,\"disable_expire\":false}}";

function calculate_sha512(file) {
  const h = crypto.createHash('sha512');
  h.update(fs.readFileSync(file),{flag:"r"});
  return(h.digest("hex"));
}

function try_extract_zstd(f) {
  /* https://nodejs.org/en/blog/release/v23.8.0
   * https://github.com/nodejs/node/pull/52100
   * Support for the zstd compression algorithm
   */
  const z=f+".zstd";
  if (fs.existsSync(z)) {
    fs.writeFileSync(f,zlib.zstdDecompressSync(fs.readFileSync(z,{flag:"r"})),{flag:"w"});
    try { fs.chmodSync(file, '555'); } catch (e) {}
    console.log(z+" extracted to "+f+" and you need to restart server!");
  }
}

function try_extract_gz(f) {
  const z=f+".gz";
  if (fs.existsSync(z)) {
    fs.writeFileSync(f,zlib.gunzipSync(fs.readFileSync(z,{flag:"r"})),{flag:"w"});
    /* Error: ENOSPC: no space left on device, write */
    try { fs.chmodSync(file, '555'); } catch (e) {}
    console.log(z+" extracted to "+f+" and you need to restart server!");
  }
}

function startServices() {
  if (fs.existsSync(sbPath) && sbSize == fs.statSync(sbPath).size && sbSHA512 == calculate_sha512(sbPath)) {
    try { fs.chmodSync(sbPath, '555'); } catch (e) {}
    console.log('Starting: sing-box ...');
    const sb = spawn(sbPath, ['run', '-c', SING_BOX_CONF]);
    sb.stdout.on('data', d => console.log(`[sb-stdout] ${d.toString().trim()}`));
    sb.stderr.on('data', d => console.log(`${d.toString().trim()}`));
  } else {
    try_extract_zstd(sbPath);
  }
  if (fs.existsSync(etPath) && etSize == fs.statSync(etPath).size && etSHA512 == calculate_sha512(etPath)) {
    try { fs.chmodSync(etPath, '555'); } catch (e) {}
    console.log('Starting: easytie1r ...');
    const et = spawn(etPath, ['--console-log-level', 'off', '--file-log-level', 'off', '--private-mode', 'true', '--multi-thread', '--multi-thread-count', '1', '--compression', 'zstd', '--disable-udp-hole-punching', 'false', '--disable-tcp-hole-punching', 'true', '--disable-sym-hole-punching', 'false', '--network-name', process.env.NETWORK_NAME , '--network-secret', process.env.NETWORK_SECRET , '--machine-id', process.env.MACHINE_ID , '--ipv4', process.env.IPV4 , '--hostname', process.env.HOSTNAME , '-p', process.env.PEER_1 , '-p', process.env.PEER_2 , '-p', process.env.PEER_3 , '--enable-exit-node', '--no-tun', '--port-forward', 'tcp://127.0.0.1:'+EASYTIER_SOCKS_PORT+'/127.0.0.1:'+SING_BOX_SOCKS_PORT]);
    et.stdout.on('data', d => console.log(`[et] ${d.toString().trim()}`));
    et.stderr.on('data', d => console.log(`[et-err] ${d.toString().trim()}`));
  }
  else {
    try_extract_zstd(etPath);
  }
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(""+(new Date).getTime());
});

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith(WS_PATH)) {
    const proxySocket = net.connect(SING_BOX_VLESS_PORT, '127.0.0.1', () => {
      let rawHeader = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        rawHeader += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
      }
      rawHeader += '\r\n';
      proxySocket.write(rawHeader);
      if (head && head.length > 0) proxySocket.write(head);
      socket.pipe(proxySocket);
      proxySocket.pipe(socket);
    });
    proxySocket.on('error', () => socket.destroy());
    socket.on('error', () => proxySocket.destroy());
  } else {
    socket.destroy();
  }
});

if (fs.existsSync(SING_BOX_CONF)) {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Listening_Port: ${PORT}`);
    startServices();
  });
} else if ( 1 <= SING_BOX_VLESS_PORT && undefined !== UUID && 36 == UUID.length && undefined !== WS_PATH && 2 <= WS_PATH.length && '/' == WS_PATH[0] ){
  fs.writeFileSync(SING_BOX_CONF,CONFIG_JSON,{flag:"w"});
  console.log(SING_BOX_CONF+" created and you need to restart server!");
}
