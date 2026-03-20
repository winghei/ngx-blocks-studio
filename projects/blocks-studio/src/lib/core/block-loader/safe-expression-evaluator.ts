import type { ResolverContext } from './ref-resolver';

type TokenType =
  | 'identifier'
  | 'number'
  | 'string'
  | 'boolean'
  | 'null'
  | 'operator'
  | 'lparen'
  | 'rparen'
  | 'dot'
  | 'comma'
  | 'question'
  | 'colon'
  | 'eof';

interface Token {
  type: TokenType;
  value: string;
}

type Expr =
  | { kind: 'literal'; value: unknown }
  | { kind: 'identifier'; name: string }
  | { kind: 'member'; object: Expr; property: string }
  | { kind: 'call'; callee: Expr; args: Expr[] }
  | { kind: 'unary'; op: string; argument: Expr }
  | { kind: 'binary'; op: string; left: Expr; right: Expr }
  | { kind: 'conditional'; test: Expr; consequent: Expr; alternate: Expr };

interface EvalContext {
  payload: unknown;
  model: Record<string, unknown>;
  currentInstance: Record<string, unknown> | undefined;
  resolveRefValue: (ref: string) => unknown;
}

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_$]/.test(ch);
}

function isIdentPart(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: ch }); i++; continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ch }); i++; continue;
    }
    if (ch === '.') {
      tokens.push({ type: 'dot', value: ch }); i++; continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', value: ch }); i++; continue;
    }
    if (ch === '?') {
      tokens.push({ type: 'question', value: ch }); i++; continue;
    }
    if (ch === ':') {
      tokens.push({ type: 'colon', value: ch }); i++; continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let out = '';
      i++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          out += input[i];
        } else {
          out += input[i];
        }
        i++;
      }
      if (input[i] !== quote) throw new Error('Unterminated string');
      i++;
      tokens.push({ type: 'string', value: out });
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let n = ch;
      i++;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        n += input[i++];
      }
      tokens.push({ type: 'number', value: n });
      continue;
    }
    const three = input.slice(i, i + 3);
    const two = input.slice(i, i + 2);
    if (['===', '!=='].includes(three)) {
      tokens.push({ type: 'operator', value: three }); i += 3; continue;
    }
    if (['&&', '||', '==', '!=', '<=', '>='].includes(two)) {
      tokens.push({ type: 'operator', value: two }); i += 2; continue;
    }
    if (['+', '-', '*', '/', '%', '<', '>', '!'].includes(ch)) {
      tokens.push({ type: 'operator', value: ch }); i++; continue;
    }
    if (isIdentStart(ch)) {
      let id = ch;
      i++;
      while (i < input.length && isIdentPart(input[i])) id += input[i++];
      if (id === 'true' || id === 'false') tokens.push({ type: 'boolean', value: id });
      else if (id === 'null') tokens.push({ type: 'null', value: id });
      else tokens.push({ type: 'identifier', value: id });
      continue;
    }
    throw new Error(`Unexpected token: ${ch}`);
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class Parser {
  constructor(private readonly tokens: Token[], private pos = 0) {}
  private peek(): Token { return this.tokens[this.pos]; }
  private next(): Token { return this.tokens[this.pos++]; }
  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
    return t;
  }
  parse(): Expr {
    const expr = this.parseConditional();
    if (this.peek().type !== 'eof') throw new Error('Unexpected trailing tokens');
    return expr;
  }
  private parseConditional(): Expr {
    const test = this.parseLogicalOr();
    if (this.peek().type === 'question') {
      this.next();
      const consequent = this.parseConditional();
      this.expect('colon');
      const alternate = this.parseConditional();
      return { kind: 'conditional', test, consequent, alternate };
    }
    return test;
  }
  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.peek().type === 'operator' && this.peek().value === '||') {
      const op = this.next().value;
      left = { kind: 'binary', op, left, right: this.parseLogicalAnd() };
    }
    return left;
  }
  private parseLogicalAnd(): Expr {
    let left = this.parseEquality();
    while (this.peek().type === 'operator' && this.peek().value === '&&') {
      const op = this.next().value;
      left = { kind: 'binary', op, left, right: this.parseEquality() };
    }
    return left;
  }
  private parseEquality(): Expr {
    let left = this.parseComparison();
    while (this.peek().type === 'operator' && ['==', '!=', '===', '!=='].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: 'binary', op, left, right: this.parseComparison() };
    }
    return left;
  }
  private parseComparison(): Expr {
    let left = this.parseAdditive();
    while (this.peek().type === 'operator' && ['<', '>', '<=', '>='].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: 'binary', op, left, right: this.parseAdditive() };
    }
    return left;
  }
  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.peek().type === 'operator' && ['+', '-'].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: 'binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }
  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.peek().type === 'operator' && ['*', '/', '%'].includes(this.peek().value)) {
      const op = this.next().value;
      left = { kind: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }
  private parseUnary(): Expr {
    if (this.peek().type === 'operator' && ['!', '+', '-'].includes(this.peek().value)) {
      const op = this.next().value;
      return { kind: 'unary', op, argument: this.parseUnary() };
    }
    return this.parsePostfix();
  }
  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    while (true) {
      if (this.peek().type === 'dot') {
        this.next();
        const id = this.expect('identifier');
        expr = { kind: 'member', object: expr, property: id.value };
        continue;
      }
      if (this.peek().type === 'lparen') {
        this.next();
        const args: Expr[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.parseConditional());
          while (this.peek().type === 'comma') {
            this.next();
            args.push(this.parseConditional());
          }
        }
        this.expect('rparen');
        expr = { kind: 'call', callee: expr, args };
        continue;
      }
      break;
    }
    return expr;
  }
  private parsePrimary(): Expr {
    const t = this.next();
    if (t.type === 'number') return { kind: 'literal', value: Number(t.value) };
    if (t.type === 'string') return { kind: 'literal', value: t.value };
    if (t.type === 'boolean') return { kind: 'literal', value: t.value === 'true' };
    if (t.type === 'null') return { kind: 'literal', value: null };
    if (t.type === 'identifier') return { kind: 'identifier', name: t.value };
    if (t.type === 'lparen') {
      const expr = this.parseConditional();
      this.expect('rparen');
      return expr;
    }
    throw new Error(`Unexpected token type: ${t.type}`);
  }
}

function evalExpr(expr: Expr, ctx: EvalContext): unknown {
  switch (expr.kind) {
    case 'literal': return expr.value;
    case 'identifier':
      if (expr.name === '$event' || expr.name === 'event' || expr.name === 'payload' || expr.name === 'value') {
        return ctx.payload;
      }
      if (expr.name in ctx.model) return ctx.model[expr.name];
      if (ctx.currentInstance != null && expr.name in ctx.currentInstance) return ctx.currentInstance[expr.name];
      return undefined;
    case 'member': {
      const obj = evalExpr(expr.object, ctx);
      if (obj == null || typeof obj !== 'object') return undefined;
      return (obj as Record<string, unknown>)[expr.property];
    }
    case 'call': {
      if (expr.callee.kind !== 'identifier' || expr.callee.name !== 'ref') {
        throw new Error('Only ref(...) calls are allowed');
      }
      if (expr.args.length !== 1) throw new Error('ref(...) requires one argument');
      const arg = evalExpr(expr.args[0], ctx);
      if (typeof arg !== 'string') return undefined;
      return ctx.resolveRefValue(arg);
    }
    case 'unary': {
      const v = evalExpr(expr.argument, ctx);
      if (expr.op === '!') return !v;
      if (expr.op === '+') return Number(v);
      if (expr.op === '-') return -Number(v);
      return undefined;
    }
    case 'binary': {
      const left = evalExpr(expr.left, ctx);
      if (expr.op === '&&') return left && evalExpr(expr.right, ctx);
      if (expr.op === '||') return left || evalExpr(expr.right, ctx);
      const right = evalExpr(expr.right, ctx);
      switch (expr.op) {
        case '+': return (left as unknown as any) + (right as unknown as any);
        case '-': return Number(left) - Number(right);
        case '*': return Number(left) * Number(right);
        case '/': return Number(left) / Number(right);
        case '%': return Number(left) % Number(right);
        case '<': return (left as number | string) < (right as number | string);
        case '>': return (left as number | string) > (right as number | string);
        case '<=': return (left as number | string) <= (right as number | string);
        case '>=': return (left as number | string) >= (right as number | string);
        case '==': return left == right;
        case '!=': return left != right;
        case '===': return left === right;
        case '!==': return left !== right;
        default: return undefined;
      }
    }
    case 'conditional':
      return evalExpr(expr.test, ctx) ? evalExpr(expr.consequent, ctx) : evalExpr(expr.alternate, ctx);
  }
}

export function evaluateSafeExpression(
  expression: string,
  resolverContext: ResolverContext,
  payload: unknown,
  resolveRefValue: (ref: string, ctx: ResolverContext) => unknown
): unknown {
  const ast = new Parser(tokenize(expression)).parse();
  return evalExpr(ast, {
    payload,
    model: (resolverContext.currentInstance?.model?.() ?? {}) as Record<string, unknown>,
    currentInstance: resolverContext.currentInstance as Record<string, unknown> | undefined,
    resolveRefValue: (ref: string) => resolveRefValue(ref, resolverContext),
  });
}
