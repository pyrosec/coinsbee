import { CoinsbeeClient } from "./coinsbee.js";
import yargs from "yargs";
import { camelCase } from "change-case";
import fs from "fs-extra";
import util from "util";
import url from "url";
import "setimmediate";
import mkdirp from "mkdirp";
import path from "path";
import { getLogger } from "./logger.js";

const args = yargs(process.argv);

const logger = getLogger();

export async function saveSession(
  coinsbee,
  json = false,
  filename = "session.json"
) {
  await mkdirp(path.join(process.env.HOME, ".coinsbee"));

  await fs.writeFile(
    path.join(process.env.HOME, ".coinsbee", filename),
    coinsbee.toJSON()
  );
  if (!json) logger.info("saved to ~/" + path.join(".coinsbee", filename));
}

export async function initSession() {
  const proxyOptions = await loadProxy();
  const coinsbee = await CoinsbeeClient.initialize({ proxyOptions });
  logger.info("getting session");
  await saveSession(coinsbee);
}

export async function loadSession() {
  const proxyOptions = await loadProxy();
  const coinsbee = CoinsbeeClient.fromJSON(
    await fs.readFile(path.join(process.env.HOME, ".coinsbee", "session.json"))
  );
  coinsbee.proxyOptions = proxyOptions;
  return coinsbee;
}

const proxyStringToObject = (proxyUri: string) => {
  const parsed = url.parse(proxyUri);
  const [username, ...passwordParts] = (parsed.auth || "").split(":");
  return {
    type: parsed.protocol.replace(":", ""),
    hostname: parsed.hostname,
    port: parsed.port,
    userId: username || null,
    password: passwordParts.join(":") || null,
  };
};

const objectToProxyString = (o: any) => {
  return (
    (o.type === "socks" ? "socks5://" : o.type + "://") +
    (o.userId ? o.userId + ":" + o.password + "@" : "") +
    o.hostname +
    (o.port ? ":" + o.port : "")
  );
};

export async function setProxy(proxyUri: string) {
  await mkdirp(path.join(process.env.HOME, ".coinsbee"));
  const proxyOptions = proxyStringToObject(proxyUri);
  const joined = objectToProxyString(proxyOptions);
  await fs.writeFile(path.join(process.env.HOME, ".coinsbee", "proxy"), joined);
  logger.info("set-proxy: " + joined);
}

export async function unsetProxy() {
  await mkdirp(path.join(process.env.HOME, ".coinsbee"));
  await fs.unlink(path.join(process.env.HOME, ".coinsbee", "proxy"));
  logger.info("unset-proxy");
}

export async function loadProxy() {
  await mkdirp(path.join(process.env.HOME, ".coinsbee"));
  try {
    return proxyStringToObject(
      await fs.readFile(
        path.join(process.env.HOME, ".coinsbee", "proxy"),
        "utf8"
      )
    );
  } catch (e) {
    return null;
  }
}

export async function callAPI(command, data) {
  const coinsbee = await loadSession();
  const camelCommand = camelCase(command);
  const json = data.j || data.json;
  const coerce = data.c || data.coerce;
  delete data.j;
  delete data.json;
  delete data.c;
  delete data.coerce;
  if (data.insecure) coinsbee.insecure = true;
  delete data.insecure;
  if (!coinsbee[camelCommand]) throw Error("command not found: " + command);
  if (json)
    coinsbee.logger = new Proxy(
      {},
      {
        get(v) {
          return () => {};
        },
      }
    ) as any;
  const result = await coinsbee[camelCommand](data);
  const coerced =
    coerce && typeof result.json === "function"
      ? await (async () => {
          const text = await result.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            return text;
          }
        })()
      : result;
  if (json) console.log(JSON.stringify(coerced, null, 2));
  else logger.info(coerced);
  await saveSession(coinsbee, json);
  return result;
}

export async function saveSessionAs(name) {
  const coinsbee = await loadSession();
  await saveSession(coinsbee, false, name + ".json");
}

export async function loadSessionFrom(name) {
  const coinsbee = CoinsbeeClient.fromObject(
    JSON.parse(await fs.readFile(path.join(process.env.HOME, ".coinsbee", name), "utf8"))
  );
  await saveSession(coinsbee);
}

export async function loadFiles(data: any) {
  const fields = [];
  for (let [k, v] of Object.entries(data)) {
    const parts = /(^.*)FromFile$/.exec(k);
    if (parts) {
      const key = parts[1];
      fields.push([key, await fs.readFile(v)]);
    } else {
      fields.push([k, v]);
    }
  }
  return fields.reduce((r, [k, v]) => {
    r[k] = v;
    return r;
  }, {});
}

export async function runCLI() {
  const [command, ...subquery] = args.argv._.slice(2);
  const options = Object.assign({}, args.argv);
  delete options._;
  const data = await loadFiles(
    Object.entries(options).reduce((r, [k, v]) => {
      r[camelCase(k)] = String(v);
      return r;
    }, {})
  );
  switch (command) {
    case "init":
      return await initSession();
      break;
    case "set-proxy":
      return await setProxy(subquery[0]);
      break;
    case "unset-proxy":
      return await unsetProxy();
      break;
    case "save":
      return await saveSessionAs(subquery[0]);
      break;
    case "load":
      return await loadSessionFrom(subquery[0]);
      break;
    default:
      return await callAPI(command, data);
      break;
  }
}
