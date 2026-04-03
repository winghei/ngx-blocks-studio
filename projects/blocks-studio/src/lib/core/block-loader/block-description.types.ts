/**
 * Service entry: root-scoped (string id or { id, alias? } with no scope) or self-scoped ({ id, scope: "self", alias? }).
 * When scope is omitted or undefined, the service is resolved from the root injector.
 */
export type ServiceEntry =
  | string
  | { id: string; scope?: 'self'; alias?: string };

/**
 * After the parent call succeeds, run `then` in order. Each step may nest `then` (runs after that step,
 * before the next sibling). Step is a callable ref string (`Block:path.method`) or an object with `ref` plus options.
 */
export type ThenChainStep =
  | string
  | {
      ref: string;
      when?: unknown;
      params?: unknown[] | Record<string, unknown>;
      then?: ThenChainStep[];
    };

export interface OutputOnError {
  ref: string;
  when?: unknown;
  params?: unknown[] | Record<string, unknown>;
}

/**
 * Object form when `params`, `when`, `then`, or `onError` are needed. `ref` is a full callable path
 * (`Block:service.path.method` — last dot segment is the method name).
 */
export interface OutputCallObject {
  ref: string;
  when?: unknown;
  params?: unknown[] | Record<string, unknown>;
  then?: ThenChainStep[];
  onError?: OutputOnError;
}

export type BlockOutputValue = string | OutputCallObject;

/** Raw block description input (optional fields may be omitted; defaults applied after validation). */
export interface BlockInput {
  component: string;
  id?: string;
  services?: ServiceEntry | ServiceEntry[];
  directives?: string | string[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, BlockOutputValue>;
}

/**
 * Block description: JSON-serializable descriptor for dynamic block loading.
 * Refs in inputs: "model.info.title" (current block) or "BlockID:model.info.title" (block id + service/model + path).
 */
export interface BlockDescription {
  component: string;
  id?: string;
  services: ServiceEntry[];
  directives: string | string[];
  inputs?: Record<string, unknown>;
  outputs?: Record<string, BlockOutputValue>;
}

export type SafeParseBlockDescriptionResult =
  | { success: true; data: BlockDescription }
  | { success: false; error: { message: string } };
