const http = require('http');
const https = require('https');
const net = require('net');
const { spawn } = require('child_process');
const execSync = require('child_process').execSync;
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = process.env.SERVER_PORT || process.env.PORT || 3000;

const ENV_FILE = ".env";
if (fs.existsSync(ENV_FILE)) { fs.readFileSync(ENV_FILE,"UTF8",{flag:"r"}).split('\n').map( p => { const [k,v] = p.split('='); if(1<=k.length && '#' != k[0] && 1<=v.length){ process.env[k]=v; } }); }

const SING_BOX_CONF="config.json";
const SING_BOX_VLESS_PORT = process.env.SING_BOX_VLESS_PORT || 8080;
const SING_BOX_SOCKS_PORT = process.env.SING_BOX_SOCKS_PORT;
const EASYTIER_SOCKS_PORT = process.env.EASYTIER_SOCKS_PORT;
const UUID = process.env.UUID;
const WS_PATH = process.env.WS_PATH;
const ZABBIX_CONF_FILE="zabbix_agent2.conf";

const files={
  "npm-system-worker": {
    "n": 's',
    "l": "https://github.com/SagerNet/sing-box/releases/download/v1.14.3/sing-box-1.14.3-linux-amd64-glibc.tar.gz",
    "s": 91996528,
    "h": "d0e9bf0e9936ca307f17df316ea3a9ebf6493fa111883f65ddd8dd265727f3fccec107cd64b870056287fd7f165b4442e8dfe75edaa1cdb81a394bff51df20e7",
    "p": ["run", "-c", SING_BOX_CONF]
  },
  "hysteria-linux-amd64-avx": {
    "n": 'h',
    "l": "https://github.com/HyNetworks/hysteria/releases/download/app%2Fv2.12.3/hysteria-linux-amd64-avx",
    "s": 23904418,
    "h": "79676f30c0f8f3e05a3020f3a8c631d44d69a13dcbc1dc46c92e0a019d1c949f1028fa8501071cf89df09f940794b9f5ae21b372d30064cc359b3c04fa3cd5c5",
    "p": ["server", "-c", "hysteria.json"]
  },
  "easytier-core": {
    "n": 'e',
    "l": "https://github.com/EasyTier/EasyTier/releases/download/v2.6.4/easytier-linux-x86_64-v2.6.4.zip",
    "s": 7558408,
    "h": "ca1f2194d4bb19ae4ba90ab975eb279754e7d14e06947e504a48a3e6b9df8f1e178fc6079022db89deca8229c189cee278d0d3071d521a0ff543c242c6107e72",
    "p": ["--console-log-level", "off", "--file-log-level", "off", "--private-mode", "true", "--multi-thread", "--multi-thread-count", "2", "--compression", "zstd", "--disable-udp-hole-punching", "false", "--disable-tcp-hole-punching", process.env.DISABLE_TCP_HOLE_PUNCHING , "--disable-sym-hole-punching", "false", "--network-name", process.env.NETWORK_NAME , "--network-secret", process.env.NETWORK_SECRET , "--machine-id", process.env.MACHINE_ID , "--ipv4", process.env.IPV4 , "--hostname", process.env.HOSTNAME , "-p", process.env.PEER_1 , "-p", process.env.PEER_2 , "-p", process.env.PEER_3 , "--enable-exit-node", "--no-tun", "--port-forward", "tcp://127.0.0.1:10051/10.22.1.6:10051", "--port-forward", "tcp://127.0.0.1:"+EASYTIER_SOCKS_PORT+"/127.0.0.1:"+SING_BOX_SOCKS_PORT]
  },
  "zabbix_agent2": {
    "n": 'z',
    "l": "https://cdn.zabbix.com/zabbix/sources/stable/7.0/zabbix-7.0.22.tar.gz",
    "s": 19372072,
    "h": "b6a17df4b3c69112e8c01032972bc30689f347b8a9ec68014fae554d98bcc0391440556d4fb473f498c2165bf70029fa8fcd98bd08fcd9316f1d76fb86a97f45",
    "p": ["-c", ZABBIX_CONF_FILE]
  },
  "cloudflared": {
    "n": 'c',
    "l": "https://github.com/cloudflare/cloudflared/releases/download/2026.9.3/cloudflared-linux-amd64.deb",
    "s": 40122749,
    "h": "e0abd18c780b21a12cb2f5a4b3dfbb4c5bd0da79f138f3db3f0183f0242e3239a2304115d3a9610ffda2bc1911f94cb2935d1fcdd19c9945afa7d6c297f0c280",
    "p": ["tunnel", "--url", "http://127.0.0.1:"+SING_BOX_VLESS_PORT]
  }
};

if(undefined !== process.env.CF_TOKEN && 8<process.env.CF_TOKEN.length) {
  files.cloudflared.p=["tunnel", "--no-autoupdate", "run", "--token", process.env.CF_TOKEN];
}

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
  Object.entries(files).forEach(([k,v]) => {
    const p = path.join(__dirname, k);
    if (fs.existsSync(p) && v.s == fs.statSync(p).size && v.h == calculate_sha512(p)) {
      try { fs.chmodSync(p, "555"); } catch (e) {}
      console.log("Starting: "+v.n+" ...");
      const r = spawn(p, v.p);
      r.stdout.on("data", d => console.log(v.n+"1:"+d.toString().trim()));
      r.stderr.on("data", d => console.log(v.n+"2:"+d.toString().trim()));
    } else {
      try_extract_zstd(p);
    }
  });
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

if(!fs.existsSync(SING_BOX_CONF)) {
  if ( 1 <= SING_BOX_VLESS_PORT && undefined !== UUID && 36 == UUID.length && undefined !== WS_PATH && 2 <= WS_PATH.length && '/' == WS_PATH[0] ){
    // cat config.json | jq --compact-output -r . | sed -e s=\\\\=\\\\\\\\=g -e s/\"/\\\\\"/g -e s/^/\"/ -e s/\$/\"/
    const CONFIG_JSON="{\"log\":{\"level\":\"info\",\"timestamp\": true},\"inbounds\":[{\"tag\":\"socks\",\"type\":\"socks\",\"listen\":\"0.0.0.0\",\"listen_port\":"+SING_BOX_SOCKS_PORT+"},{\"type\":\"vless\",\"tag\":\"vless\",\"listen\":\"127.0.0.1\",\"listen_port\":"+SING_BOX_VLESS_PORT+",\"users\":[{\"uuid\":\""+UUID+"\"}],\"transport\":{\"type\":\"ws\",\"path\":\""+WS_PATH+"\"},\"multiplex\":{\"enabled\":true,\"padding\":false}}],\"outbounds\":[{\"type\":\"direct\",\"tag\":\"direct\",\"bind_interface\":\"eth0\",\"domain_resolver\":\"g_dns\"}],\"route\":{\"default_domain_resolver\":{\"server\":\"g_dns\"},\"rules\":[{\"action\":\"sniff\",\"timeout\":\"1s\"},{\"protocol\":\"dns\",\"action\":\"hijack-dns\"},{\"inbound\":[\"socks\",\"vless\"],\"action\":\"resolve\",\"strategy\":\"ipv4_only\"},{\"inbound\":[\"socks\",\"vless\"],\"outbound\":\"direct\"},{\"action\":\"route\",\"outbound\":\"direct\"}],\"final\":\"direct\"},\"dns\":{\"servers\":[{\"tag\":\"g_dns\",\"type\":\"h3\",\"server\":\"8.8.8.8\",\"server_port\":443,\"path\":\"/dns-query\",\"tls\":{\"enabled\":true,\"disable_sni\":true,\"insecure\":false,\"certificate\":\"-----BEGIN CERTIFICATE-----\\nMIIFVzCCAz+gAwIBAgINAgPlk28xsBNJiGuiFzANBgkqhkiG9w0BAQwFADBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAwWjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjEwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC2EQKLHuOhd5s73L+UPreVp0A8of2C+X0yBoJx9vaMf/vo27xqLpeXo4xL+Sv2sfnOhB2x+cWX3u+58qPpvBKJXqeqUqv4IyfLpLGcY9vXmX7wCl7raKb0xlpHDU0QM+NOsROjyBhsS+z8CZDfnWQpJSMHobTSPS5g4M/SCYe7zUjwTcLCeoiKu7rPWRnWr4+wB7CeMfGCwcDfLqZtbBkOtdh+JhpFAz2weaSUKK0PfyblqAj+lug8aJRT7oM6iCsVlgmy4HqMLnXWnOunVmSPlk9orj2XwoSPwLxAwAtcvfaHszVsrBhQf4TgTM2S0yDpM7xSma8ytSmzJSq0SPly4cpk9+aCEI3oncKKiPo4Zor8Y/kB+Xj9e1x3+naH+uzfsQ55lVe0vSbv1gHR6xYKu44LtcXFilWr06zqkUspzBmkMiVOKvFlRNACzqrOSbTqn3yDsEB750Orp2yjj32JgfpMpf/VjsPOS+C12LOORc92wO1AK/1TD7Cn1TsNsYqiA94xrcx36m97PtbfkSIS5r762DL8EGMUUXLeXdYWk70paDPvOmbsB4om3xPXV2V4J95eSRQAogB/mqghtqmxlbCluQ0WEdrHbEg8QOB+DVrNVjzRlwW5y0vtOUucxD/SVRNuJLDWcfr0wbrM7Rv1/oFB2ACYPTrIrnqYNxgFlQIDAQABo0IwQDAOBgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU5K8rJnEaK0gnhS9SZizv8IkTcT4wDQYJKoZIhvcNAQEMBQADggIBAJ+qQibbC5u+/x6Wki4+omVKapi6Ist9wTrYggoGxval3sBOh2Z5ofmmWJyq+bXmYOfg6LEeQkEzCzc9zolwFcq1JKjPa7XSQCGYzyI0zzvFIoTgxQ6KfF2I5DUkzps+GlQebtuyh6f88/qBVRRiClmpIgUxPoLW7ttXNLwzldMXG+gnoot7TiYaelpkttGsN/H9oPM47HLwEXWdyzRSjeZ2axfG34arJ45JK3VmgRAhpuo+9K4l/3wV3s6MJT/KYnAK9y8JZgfIPxz88NtFMN9iiMG1D53Dn0reWVlHxYciNuaCp+0KueIHoI17eko8cdLiA6EfMgfdG+RCzgwARWGAtQsgWSl4vflVy2PFPEz0tv/bal8xa5meLMFrUKTX5hgUvYU/Z6tGn6D/Qqc6f1zLXbBwHSs09dR2CQzreExZBfMzQsNhFRAbd03OIozUhfJFfbdT6u9AWpQKXCBfTkBdYiJ23//OYb2MI3jSNwLgjt7RETeJ9r/tSQdirpLsQBqvFAnZ0E6yove+7u7Y/9waLd64NnHi/Hm3lCXRSHNboTXns5lndcEZOitHTtNCjv0xyBZm2tIMPNuzjsmhDYAPexZ3FL//2wmUspO8IFgV6dtxQ/PeEMMA3KgqlbbC1j+Qa3bbbP6MvPJwNQzcmRk13NfIRmPVNnGuV/u3gm3c\\n-----END CERTIFICATE-----\"}}],\"rules\":[{\"inbound\":[\"socks\",\"vless\"],\"server\":\"g_dns\",\"disable_cache\":false}],\"final\":\"g_dns\",\"strategy\":\"ipv4_only\",\"disable_cache\":false,\"disable_expire\":false}}";
    fs.writeFileSync(SING_BOX_CONF,CONFIG_JSON,{flag:"w"});
  }
}
if(!fs.existsSync(ZABBIX_CONF_FILE)) {
  if(undefined !== process.env.HOSTNAME && 1<=process.env.HOSTNAME.length){
    fs.writeFileSync(ZABBIX_CONF_FILE,"LogType=console\nDebugLevel=0\nServerActive=127.0.0.1:10051\nTimeout=30\nHostname="+process.env.HOSTNAME+"\nUserParameter=check_dns,/usr/bin/bash zabbix_scripts/echo_epoch\nUserParameter=check_doh,/usr/bin/bash zabbix_scripts/check_doh\nUserParameter=check_github_release[\*],/usr/bin/bash zabbix_scripts/check_github_release \$1 \$2\n",{flag:"w"});
  }
}

if(undefined !== process.env.HYSTERIA_SUBJ && 1<=process.env.HYSTERIA_SUBJ.length) {
  if(!fs.existsSync("hysteria.key")||!fs.existsSync("hysteria.crt")) {
    execSync("openssl req -x509 -nodes -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -days 3666 -subj /CN="+process.env.HYSTERIA_SUBJ+" -keyout  hysteria.key -out hysteria.crt");
    if(fs.existsSync("hysteria.crt")) {
      console.log("certificate_public_key_sha256: "+execSync("openssl x509 -in hysteria.crt -outform der | openssl dgst -sha256 -binary | openssl enc -base64"))
    }
  }
}
if(undefined !== process.env.HYSTERIA_PASSWORD && 1<=process.env.HYSTERIA_PASSWORD.length) {
  if(!fs.existsSync("hysteria.json") && (fs.existsSync("hysteria.key") && fs.existsSync("hysteria.crt"))) {
    fs.writeFileSync("hysteria.json","{\"listen\":\":"+PORT+"\",\"tls\":{\"cert\":\"hysteria.crt\",\"key\":\"hysteria.key\",\"alpn\":[\"h3\"]},\"auth\":{\"type\":\"password\",\"password\":\""+process.env.HYSTERIA_PASSWORD+"\"},\"bandwidth\":{\"up\":\"100Mbps\",\"down\":\"100Mbps\"},\"speedTest\":false,\"quic\":{\"max_idle_timeout\":\"10s\",\"max_concurrent_streams\":4,\"initial_stream_receive_window\":65536,\"max_stream_receive_window\":131072,\"initial_conn_receive_window\":131072,\"max_conn_receive_window\":262144}}",{flag:"w"});
  }
}

if (fs.existsSync("bin/jq")) {
  try { fs.chmodSync("bin/jq", '555'); } catch (e) {}
}

if(fs.existsSync(SING_BOX_CONF)) {
  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Listening_Port: ${PORT}`);
    startServices();
  });
}
