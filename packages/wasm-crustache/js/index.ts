export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonObject | JsonPrimitive | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

type WasmTemplate = {
  render: (data: JsonValue) => string;
};

type WasmModule = {
  default?: () => Promise<unknown>;
  Template: new (template: string) => WasmTemplate;
  render: (template: string, data: JsonValue) => string;
};

let wasmModulePromise: Promise<WasmModule> | null = null;

const isNodeRuntime = (): boolean => {
  return typeof process !== 'undefined' && typeof process.versions?.node === 'string';
};

const loadWasmModule = async (): Promise<WasmModule> => {
  const modulePath = isNodeRuntime()
    ? './wasm/node/wasm_crustache.js'
    : './wasm/bundler/wasm_crustache.js';

  const module = (await import(modulePath)) as WasmModule;

  if (typeof module.default === 'function') {
    await module.default();
  }

  return module;
};

const getWasmModule = async (): Promise<WasmModule> => {
  if (!wasmModulePromise) {
    wasmModulePromise = loadWasmModule();
  }

  return wasmModulePromise;
};

export const init = async (): Promise<void> => {
  await getWasmModule();
};

export const render = async (template: string, data: JsonValue): Promise<string> => {
  const module = await getWasmModule();

  return module.render(template, data);
};

export class Template {
  private readonly inner: WasmTemplate;

  private constructor(inner: WasmTemplate) {
    this.inner = inner;
  }

  static compile = async (template: string): Promise<Template> => {
    const module = await getWasmModule();
    const inner = new module.Template(template);

    return new Template(inner);
  };

  render = (data: JsonValue): string => {
    return this.inner.render(data);
  };
}
