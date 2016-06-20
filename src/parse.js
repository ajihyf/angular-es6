/* @flow */
import _ from 'lodash';
import { filter } from './filter';

function isNumber(ch: ?string): boolean {
  if (ch == null) return false;
  return ch >= '0' && ch <= '9';
}

function isExpOperator(ch: ?string): boolean {
  return ch === '-' || ch === '+' || isNumber(ch);
}

function isIdentifier(ch: ?string): boolean {
  if (typeof ch !== 'string') return false;
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
}

function isWhiteSpace(ch: ?string) {
  return ch === ' ' || ch === '\r' || ch === '\t' ||
    ch === '\n' || ch === '\v' || ch === '\u00A0';
}

const ESCAPE_MAP: { [key: string]: string } = {
  'n': '\n',
  'f': '\f',
  'r': '\r',
  't': '\t',
  'v': '\v',
  '\'': '\'',
  '"': '"'
};

const OperatorsMap: { [key: string]: true } = {
  '+': true,
  '!': true,
  '-': true,
  '*': true,
  '/': true,
  '%': true,
  '=': true,
  '==': true,
  '!=': true,
  '===': true,
  '!==': true,
  '<': true,
  '>': true,
  '<=': true,
  '>=': true,
  '&&': true,
  '||': true,
  '|': true
};

const stringEscapeRegex: RegExp = /[^ a-zA-Z0-9]/g;

function stringEscapeFn(ch: string) {
  const unicode = `0000${ch.charCodeAt(0).toString(16)}`;
  return `\\u${unicode.slice(-4)}`;
}

function escape<T>(value: T): T | string {
  if (typeof value === 'string') {
    return `'${value.replace(stringEscapeRegex, stringEscapeFn)}'`;
  } else if (value === null) {
    return 'null';
  }
  return value;
}

type LexToken = {
  text: string,
  value?: any,
  identifier?: boolean
};

class Lexer {
  text: string;
  index: number;
  tokens: LexToken[];

  readNumber() {
    let number: string = '';
    while (this.index < this.text.length) {
      const ch = this.text.charAt(this.index).toLocaleLowerCase();
      if (ch === '.' || isNumber(ch)) {
        number += ch;
      } else {
        const nextCh = this.peek();
        const prevCh = number[number.length - 1];
        if (ch === 'e' && isExpOperator(nextCh)) {
          number += ch;
        } else if (prevCh === 'e' && isExpOperator(ch) && nextCh && isNumber(nextCh)) {
          number += ch;
        } else if (isExpOperator(ch) && prevCh === 'e' && (!nextCh || !isNumber(nextCh))) {
          throw new Error('Invalid exponent');
        } else {
          break;
        }
      }
      this.index++;
    }
    this.tokens.push({
      text: number,
      value: _.toNumber(number)
    });
  }

  readString(quote: string) {
    this.index++;
    let str: string = '';
    let rawString: string = '';
    let escape: boolean = false;
    while (this.index < this.text.length) {
      const ch = this.text.charAt(this.index);
      rawString += ch;
      if (escape) {
        if (ch === 'u') {
          const hex = this.peek(4);
          this.index += 4;
          if (hex == null || !hex.match(/[\da-f]{4}/i)) {
            throw new Error('Invalid unicode escape');
          }
          str += String.fromCharCode(parseInt(hex, 16));
        } else {
          const replacement = ESCAPE_MAP[ch];
          if (replacement) {
            str += replacement;
          } else {
            str += ch;
          }
        }
        escape = false;
      } else if (ch === quote) {
        this.index++;
        this.tokens.push({
          text: rawString,
          value: str
        });
        return;
      } else if (ch === '\\') {
        escape = true;
      } else {
        str += ch;
      }
      this.index++;
    }
    throw new Error('Unmatched Quote');
  }

  readIdentifier() {
    let text = '';
    while (this.index < this.text.length) {
      const ch = this.text.charAt(this.index);
      if (isIdentifier(ch) || isNumber(ch)) {
        text += ch;
      } else {
        break;
      }
      this.index++;
    }
    this.tokens.push({
      text,
      identifier: true
    });
  }

  lex(text: string): LexToken[] {
    this.text = text;
    this.index = 0;
    this.tokens = [];

    while (this.index < this.text.length) {
      const ch = this.text.charAt(this.index);
      if (isNumber(ch) ||
        (ch === '.' && isNumber(this.peek()))) {
        this.readNumber();
      } else if (_.includes('\'"', ch)) {
        this.readString(ch);
      } else if (_.includes('[],{}:.()?;', ch)) {
        this.tokens.push({
          text: ch
        });
        this.index++;
      } else if (isIdentifier(ch)) {
        this.readIdentifier();
      } else if (isWhiteSpace(ch)) {
        this.index++;
      } else {
        const nextStrings: Array<string> = [ch];
        [1, 2].forEach(offset => {
          const nextChars = this.peek(offset);
          if (nextChars) {
            nextStrings.push(ch + nextChars);
          }
        });
        const findOp: ?string = _.findLast(nextStrings, chars => OperatorsMap[chars]);
        if (findOp) {
          this.tokens.push({ text: findOp });
          this.index += findOp.length;
        } else {
          throw new Error(`Unexpected next character: ${ch}`);
        }
      }
    }

    return this.tokens;
  }

  peek(offset: number = 1): ?string {
    if (this.index > this.text.length - offset) {
      return null;
    }
    return this.text.substr(this.index + 1, offset);
  }
}

type ASTNode = ASTProgramNode
  | ASTLiteralNode
  | ASTArrayExpressionNode
  | ASTObjectNode
  | ASTPropertyNode
  | ASTIdentifierNode
  | ASTThisExpressionNode
  | ASTMemberExpressionNode
  | ASTCallExpressionNode
  | ASTAssignmentExpressionNode
  | ASTUnaryExpressionNode
  | ASTBinaryExpressionNode
  | ASTLogicalExpressionNode
  | ASTConditionalExpressionNode;

type ASTProgramNode = {
  type: 'Program',
  body: ASTNode[]
};

type ASTLiteralNode = {
  type: 'Literal',
  value: any
};

type ASTArrayExpressionNode = {
  type: 'ArrayExpression',
  elements: ASTNode[]
};

type ASTObjectNode = {
  type: 'ObjectExpression',
  properties: ASTPropertyNode[]
};

type ASTPropertyNode = {
  type: 'Property',
  key: ASTLiteralNode | ASTIdentifierNode,
  value: ASTNode
};

type ASTIdentifierNode = {
  type: 'Identifier',
  name: string
};

type ASTThisExpressionNode = {
  type: 'ThisExpression'
};

type ASTMemberExpressionNode = {
  type: 'MemberExpression',
  object: ASTNode,
  property: ASTNode,
  computed: true
} | {
  type: 'MemberExpression',
  object: ASTNode,
  property: ASTIdentifierNode,
  computed?: false
};

type ASTCallExpressionNode = {
  type: 'CallExpression',
  callee: ASTIdentifierNode,
  arguments: ASTNode[],
  filter: true
} | {
  type: 'CallExpression',
  callee: ASTNode,
  arguments: ASTNode[],
  filter?: false
};

type ASTAssignmentExpressionNode = {
  type: 'AssignmentExpression',
  left: ASTNode,
  right: ASTNode
};

type ASTUnaryExpressionNode = {
  type: 'UnaryExpression',
  operator: string,
  argument: ASTNode
};

type ASTBinaryExpressionNode = {
  type: 'BinaryExpression',
  operator: string,
  left: ASTNode,
  right: ASTNode
};

type ASTLogicalExpressionNode = {
  type: 'LogicalExpression',
  operator: string,
  left: ASTNode,
  right: ASTNode
};

type ASTConditionalExpressionNode = {
  type: 'ConditionalExpression',
  test: ASTNode,
  consequent: ASTNode,
  alternate: ASTNode
};

const ASTNodeType = {
  Program: 'Program',
  Literal: 'Literal',
  ArrayExpression: 'ArrayExpression',
  ObjectExpression: 'ObjectExpression',
  Property: 'Property',
  Identifier: 'Identifier',
  ThisExpression: 'ThisExpression',
  MemberExpression: 'MemberExpression',
  CallExpression: 'CallExpression',
  AssignmentExpression: 'AssignmentExpression',
  UnaryExpression: 'UnaryExpression',
  BinaryExpression: 'BinaryExpression',
  LogicalExpression: 'LogicalExpression',
  ConditionalExpression: 'ConditionalExpression'
};

const LanguageConstants: { [key: string]: (ASTThisExpressionNode | ASTLiteralNode) } = {
  'this': { type: ASTNodeType.ThisExpression },
  'null': { type: ASTNodeType.Literal, value: null },
  'true': { type: ASTNodeType.Literal, value: true },
  'false': { type: ASTNodeType.Literal, value: false },
  'undefined': { type: ASTNodeType.Literal, value: undefined }
};

class AST {
  lexer: Lexer;
  tokens: LexToken[];

  constructor(lexer: Lexer) {
    this.lexer = lexer;
  }

  peek(...expections: Array<?string>): ?LexToken {
    if (this.tokens.length > 0) {
      const text = this.tokens[0].text;
      if (_.includes(expections, text) || _.every(expections, _.isNil)) {
        return this.tokens[0];
      }
    }
  }

  expect(...expections: Array<?string>): ?LexToken {
    const token = this.peek(...expections);
    if (token) {
      return this.tokens.shift();
    }
  }

  consume(e: ?string): LexToken {
    const token = this.expect(e);
    if (!token) {
      throw new Error(`Unexpected. Expected ${e}`);
    }
    return token;
  }

  ast(text): ASTNode {
    this.tokens = this.lexer.lex(text);
    return this.program();
  }

  program(): ASTProgramNode {
    const body: ASTNode[] = [];
    do {
      if (this.tokens.length) {
        body.push(this.filter());
      }
    } while (this.expect(';'));
    return { type: ASTNodeType.Program, body };
  }

  computedMemberExpression(object: ASTNode): ASTMemberExpressionNode {
    const primary: ASTMemberExpressionNode = {
      type: ASTNodeType.MemberExpression,
      object,
      property: this.primary(),
      computed: true
    };
    this.consume(']');
    return primary;
  }

  nonComputedMemberExpression(object: ASTNode): ASTMemberExpressionNode {
    return {
      type: ASTNodeType.MemberExpression,
      object,
      property: this.identifier(),
      computed: false
    };
  }

  callExpression(callee: ASTNode): ASTCallExpressionNode {
    const callExpression: ASTCallExpressionNode = {
      type: ASTNodeType.CallExpression,
      callee,
      arguments: []
    };
    if (!this.peek(')')) {
      do {
        callExpression.arguments.push(this.assignment());
      } while (this.expect(','));
    }
    this.consume(')');
    return callExpression;
  }

  assignment(): ASTNode {
    const left = this.ternary();
    if (this.expect('=')) {
      const right = this.ternary();
      return {
        type: ASTNodeType.AssignmentExpression,
        left, right
      };
    }
    return left;
  }

  primary(): ASTNode {
    let primary: ASTNode;
    if (this.expect('(')) {
      primary = this.filter();
      this.consume(')');
    } else if (this.expect('[')) {
      primary = this.arrayDeclaration();
    } else if (this.expect('{')) {
      primary = this.object();
    } else if (_.has(LanguageConstants, this.tokens[0].text)) {
      primary = LanguageConstants[this.consume().text];
    } else {
      const peek = this.peek();
      if (peek && peek.identifier) {
        primary = this.identifier();
      } else {
        primary = this.constant();
      }
    }
    let next: ?LexToken;
    while ((next = this.expect('.', '[', '('))) {
      if (next.text === '[') {
        primary = this.computedMemberExpression(primary);
      } else if (next.text === '.') {
        primary = this.nonComputedMemberExpression(primary);
      } else if (next.text === '(') {
        primary = this.callExpression(primary);
      }
    }
    return primary;
  }

  object(): ASTObjectNode {
    const properties: ASTPropertyNode[] = [];
    if (!this.peek('}')) {
      do {
        const peek = this.peek();
        if (peek == null) {
          throw new Error('Unexpected terminates.');
        }
        const key = peek.identifier ? this.identifier() : this.constant();
        this.consume(':');
        const value = this.assignment();
        properties.push({
          type: ASTNodeType.Property,
          key,
          value
        });
      } while (this.expect(','));
    }
    this.consume('}');
    return { type: ASTNodeType.ObjectExpression, properties };
  }

  arrayDeclaration(): ASTArrayExpressionNode {
    const elements: ASTNode[] = [];
    if (!this.peek(']')) {
      do {
        if (this.peek(']')) {
          break;
        }
        elements.push(this.assignment());
      } while (this.expect(','));
    }
    this.consume(']');
    return { type: ASTNodeType.ArrayExpression, elements };
  }

  constant(): ASTLiteralNode {
    const node = this.consume();
    return { type: ASTNodeType.Literal, value: node.value };
  }

  identifier(): ASTIdentifierNode {
    const node = this.consume();
    if (!node.identifier) {
      throw new Error(`Tokenize Error: ${node.text} is not an identifier`);
    }
    return { type: ASTNodeType.Identifier, name: node.text };
  }

  unary(): ASTNode {
    const token = this.expect('+', '!', '-');
    if (token) {
      return {
        type: ASTNodeType.UnaryExpression,
        operator: token.text,
        argument: this.unary()
      };
    } else {
      return this.primary();
    }
  }

  multiplicative(): ASTNode {
    let left: ASTNode = this.unary();
    let token: ?LexToken;
    while ((token = this.expect('*', '/', '%'))) {
      left = {
        type: ASTNodeType.BinaryExpression,
        operator: token.text,
        left: left,
        right: this.unary()
      };
    }
    return left;
  }

  additive(): ASTNode {
    let left: ASTNode = this.multiplicative();
    let token: ?LexToken;
    while ((token = this.expect('+', '-'))) {
      left = {
        type: ASTNodeType.BinaryExpression,
        operator: token.text,
        left: left,
        right: this.multiplicative()
      };
    }
    return left;
  }

  equality(): ASTNode {
    let left: ASTNode = this.relational();
    let token: ?LexToken;
    while ((token = this.expect('==', '!=', '===', '!=='))) {
      left = {
        type: ASTNodeType.BinaryExpression,
        left: left,
        right: this.relational(),
        operator: token.text
      };
    }
    return left;
  }

  relational(): ASTNode {
    let left: ASTNode = this.additive();
    let token: ?LexToken;
    while ((token = this.expect('<', '>', '>=', '<='))) {
      left = {
        type: ASTNodeType.BinaryExpression,
        left: left,
        right: this.additive(),
        operator: token.text
      };
    }
    return left;
  }

  logicalAND(): ASTNode {
    let left: ASTNode = this.equality();
    let token: ?LexToken;
    while ((token = this.expect('&&'))) {
      left = {
        type: ASTNodeType.LogicalExpression,
        left: left,
        right: this.equality(),
        operator: token.text
      };
    }
    return left;
  }

  logicalOR(): ASTNode {
    let left: ASTNode = this.logicalAND();
    let token: ?LexToken;
    while ((token = this.expect('||'))) {
      left = {
        type: ASTNodeType.LogicalExpression,
        left: left,
        right: this.logicalAND(),
        operator: token.text
      };
    }
    return left;
  }

  ternary(): ASTNode {
    const test = this.logicalOR();
    if (this.expect('?')) {
      const consequent = this.assignment();
      if (this.consume(':')) {
        const alternate = this.assignment();
        return {
          type: ASTNodeType.ConditionalExpression,
          test, consequent, alternate
        };
      }
    }
    return test;
  }

  filter(): ASTNode {
    let left: ASTNode = this.assignment();
    while (this.expect('|')) {
      const args: ASTNode[] = [left];
      left = {
        type: ASTNodeType.CallExpression,
        callee: this.identifier(),
        arguments: args,
        filter: true
      };
      while (this.expect(':')) {
        args.push(this.assignment());
      }
    }
    return left;
  }
}

function ensureSafeMemberName(name: string) {
  if (_.includes(['constructor', '__proto__', '__defineGetter__',
    '__defineSetter__', '__lookupGetter__', '__lookupSetter__'], name)) {
    throw new Error('Attempting to access a disallowed field');
  }
}

function isDOMNode(o: any): boolean {
  return (
    typeof Node === 'object' ? o instanceof Node
      : o && typeof o === 'object' && typeof o.nodeType === 'number' && typeof o.nodeName === 'string'
  );
}

function ensureSafeObject<T>(obj: T): T {
  if (obj) {
    // should not use obj === window, may be tricked by Object.create(window)
    if (obj.document && obj.location && obj.alert && obj.setTimeout) {
      throw new Error('Referencing window is not allowed');
    } else if ((obj: any).constructor === obj) {
      throw new Error('Referencing Function is not allowed');
    } else if (obj.getOwnPropertyNames || obj.getOwnPropertyDescriptor) {
      throw new Error('Referencing Object is not allowed');
    } else if (isDOMNode(obj)) {
      throw new Error('Referencing DOM node is not allowed');
    }
  }
  return obj;
}

function ensureSafeFunction<T>(obj: T): T {
  if (obj) {
    if ((obj: any).constructor === obj) {
      throw new Error('Referencing Function is not allowed');
    } else if (obj === Function.prototype.call ||
      obj === Function.prototype.apply ||
      obj === Function.prototype.bind) {
      throw new Error('Referencing call, apply or bind is not allowed');
    }
  }
  return obj;
}

function isDefined<U, V>(value: U, defaultValue: V): U | V {
  return typeof value === 'undefined' ? defaultValue : value;
}

type ASTCompilerState = {
  body: string[],
  nextId: number,
  vars: string[],
  filters: { [k: string]: string }
};

type CallContext = {
  context?: string,
  name?: string,
  computed?: boolean
};

class ASTCompiler {
  state: ASTCompilerState;
  astBuilder: AST;

  constructor(astBuilder: AST) {
    this.astBuilder = astBuilder;
  }

  compile(text: string): ParsedFunction {
    const ast: ASTNode = this.astBuilder.ast(text);
    this.state = { body: [], nextId: 0, vars: [], filters: {} };
    this.recurse(ast);
    // s means scope, l means locals
    const fnString = `
    ${this.filterPrefix()}
    var fn = function(s, l) {
      ${this.state.vars.length ? `var ${this.state.vars.join(',')};` : ''}
      ${this.state.body.join('')}
    }
    return fn;
    `;
    /* eslint-disable no-new-func */
    const fn = new Function(
      'ensureSafeMemberName',
      'ensureSafeObject',
      'ensureSafeFunction',
      'filter',
      'isDefined',
      fnString)(
      ensureSafeMemberName,
      ensureSafeObject,
      ensureSafeFunction,
      filter,
      isDefined);
    /* eslint-enable no-new-func */
    return (fn: any);
  }

  filterPrefix(): string {
    if (_.isEmpty(this.state.filters)) {
      return '';
    } else {
      const parts = _.map(this.state.filters,
        (varName, filterName) => `${varName} = filter(${escape(filterName)})`);
      return `var ${parts.join(',')};`;
    }
  }

  filter(name: string): string {
    if (!_.has(this.state.filters, name)) {
      this.state.filters[name] = this.nextId(true);
    }
    return this.state.filters[name];
  }

  nextId(skip: boolean = false): string {
    const id = `$$vv${this.state.nextId++}`;
    if (!skip) {
      this.state.vars.push(id);
    }
    return id;
  }

  recurse(ast: ASTNode, inContext?: CallContext, create?: boolean): any {
    let varId: string;
    switch (ast.type) {
      case ASTNodeType.Literal:
        return escape(ast.value);
      case ASTNodeType.Program:
        _.each(_.initial(ast.body), stmt => {
          this.state.body.push(this.recurse(stmt), ';');
        });
        this.state.body.push(`return ${this.recurse(_.last(ast.body))};`);
        break;
      case ASTNodeType.ArrayExpression:
        const elements = _.map(ast.elements, element => this.recurse(element));
        return `[${elements.join(',')}]`;
      case ASTNodeType.ObjectExpression:
        const properties = _.map(ast.properties, property => {
          const key = property.key.type === ASTNodeType.Identifier
            ? property.key.name : escape(property.key.value);
          const value = this.recurse(property.value);
          return `${key}:${value}`;
        });
        return `{${properties.join(',')}}`;
      case ASTNodeType.Identifier:
        ensureSafeMemberName(ast.name);
        varId = this.nextId();
        this.if_(
          ASTCompiler.getHasOwnProperty('l', ast.name),
          ASTCompiler.assign(varId, ASTCompiler.nonComputedMember('l', ast.name)));
        if (create) {
          this.if_(
            `${ASTCompiler.not(ASTCompiler.getHasOwnProperty('l', ast.name))}
            && s && ${ASTCompiler.not(ASTCompiler.getHasOwnProperty('s', ast.name))}`,
            ASTCompiler.assign(ASTCompiler.nonComputedMember('s', ast.name), '{}'));
        }
        this.if_(
          `${ASTCompiler.not(ASTCompiler.getHasOwnProperty('l', ast.name))} && s`,
          ASTCompiler.assign(varId, ASTCompiler.nonComputedMember('s', ast.name)));
        if (inContext) {
          inContext.context = `${ASTCompiler.getHasOwnProperty('l', ast.name)} ? l : s`;
          inContext.name = ast.name;
          inContext.computed = false;
        }
        this.addEnsureSafeObject(varId);
        return varId;
      case ASTNodeType.ThisExpression:
        return 's';
      case ASTNodeType.MemberExpression:
        varId = this.nextId();
        const left = this.recurse(ast.object, undefined, create);
        if (inContext) {
          inContext.context = left;
        }
        if (ast.computed) {
          const right = this.recurse(ast.property);
          this.addEnsureSafeMemberName(right);
          if (create) {
            const computedMember = ASTCompiler.computedMember(left, right);
            this.if_(
              ASTCompiler.not(computedMember),
              ASTCompiler.assign(computedMember, '{}'));
          }
          this.if_(left,
            ASTCompiler.assign(varId,
              `ensureSafeObject(${ASTCompiler.computedMember(left, right)})`));
          if (inContext) {
            inContext.computed = true;
            inContext.name = right;
          }
        } else {
          ensureSafeMemberName(ast.property.name);
          if (create) {
            const nonComputedMember = ASTCompiler.nonComputedMember(left, ast.property.name);
            this.if_(
              ASTCompiler.not(nonComputedMember),
              ASTCompiler.assign(nonComputedMember, '{}'));
          }
          this.if_(left,
            ASTCompiler.assign(varId,
              `ensureSafeObject(${ASTCompiler.nonComputedMember(left, ast.property.name)})`));
          if (inContext) {
            inContext.computed = false;
            inContext.name = ast.property.name;
          }
        }
        return varId;
      case ASTNodeType.CallExpression:
        if (ast.filter) {
          const callee = this.filter(ast.callee.name);
          const args = _.map(ast.arguments, arg => this.recurse(arg));
          return `${callee}(${args})`;
        } else {
          const callContext: CallContext = {};
          let callee = this.recurse(ast.callee, callContext);
          const args = _.map(ast.arguments,
            arg => `ensureSafeObject(${this.recurse(arg)})`);
          if (callContext.context && callContext.name) {
            if (callContext.computed) {
              callee = ASTCompiler.computedMember(callContext.context, callContext.name);
            } else {
              callee = ASTCompiler.nonComputedMember(callContext.context, callContext.name);
            }
            this.addEnsureSafeObject(callContext.context);
          }
          this.addEnsureSafeFunction(callee);
          return `${callee} && ensureSafeObject(${callee}(${args.join(',')}))`;
        }
      case ASTNodeType.AssignmentExpression:
        const leftContext: CallContext = {};
        this.recurse(ast.left, leftContext, true);
        let leftExpr: ?string;
        if (leftContext.context && leftContext.name) {
          if (leftContext.computed) {
            leftExpr = ASTCompiler.computedMember(leftContext.context, leftContext.name);
          } else {
            leftExpr = ASTCompiler.nonComputedMember(leftContext.context, leftContext.name);
          }
        }
        if (leftExpr == null) {
          throw new Error(`Unable to get leftContext info: ${JSON.stringify(leftContext)}`);
        }
        return ASTCompiler.assign(leftExpr,
          `ensureSafeObject(${this.recurse(ast.right)})`);
      case ASTNodeType.UnaryExpression:
        return `${ast.operator}(${ASTCompiler.isDefined(this.recurse(ast.argument), 0)})`;
      case ASTNodeType.BinaryExpression:
        if (ast.operator === '+' || ast.operator === '-') {
          return `(${ASTCompiler.isDefined(this.recurse(ast.left), 0)}) ${ast.operator} \
          (${ASTCompiler.isDefined(this.recurse(ast.right), 0)})`;
        }
        return `(${this.recurse(ast.left)}) ${ast.operator} (${this.recurse(ast.right)})`;
      case ASTNodeType.LogicalExpression:
        varId = this.nextId();
        this.state.body.push(ASTCompiler.assign(varId, this.recurse(ast.left)));
        this.if_(ast.operator === '&&' ? varId : ASTCompiler.not(varId),
          ASTCompiler.assign(varId, this.recurse(ast.right)));
        return varId;
      case ASTNodeType.ConditionalExpression:
        varId = this.nextId();
        const testId = this.nextId();
        this.state.body.push(ASTCompiler.assign(testId, this.recurse(ast.test)));
        this.if_(testId,
          ASTCompiler.assign(varId, this.recurse(ast.consequent)));
        this.if_(ASTCompiler.not(testId),
          ASTCompiler.assign(varId, this.recurse(ast.alternate)));
        return varId;
      default:
        throw new Error('Unknown ASTNode type');
    }
  }

  addEnsureSafeFunction(expr: string) {
    this.state.body.push(`ensureSafeFunction(${expr});`);
  }

  addEnsureSafeMemberName(expr: string) {
    this.state.body.push(`ensureSafeMemberName(${expr});`);
  }

  addEnsureSafeObject(expr: string) {
    this.state.body.push(`ensureSafeObject(${expr});`);
  }

  if_(test: string, consequent: string) {
    this.state.body.push(`if(${test}){${consequent}}`);
  }

  static isDefined(value: any, defaultValue: any): string {
    return `isDefined(${value}, ${escape(defaultValue)})`;
  }

  static computedMember(left: string, right: string): string {
    return `(${left})[${right}]`;
  }

  static nonComputedMember(left: string, right: string): string {
    return `(${left}).${right}`;
  }

  static assign(name: string, value: string): string {
    return `${name}=${value};`;
  }

  static not(name: string): string {
    return `!(${name})`;
  }

  static getHasOwnProperty(object: string, property: string): string {
    return `${object} && ${object}.hasOwnProperty(${escape(property)})`;
  }
}

class Parser {
  lexer: Lexer;
  ast: AST;
  astCompiler: ASTCompiler;

  constructor(lexer: Lexer) {
    this.lexer = lexer;
    this.ast = new AST(this.lexer);
    this.astCompiler = new ASTCompiler(this.ast);
  }

  parse(text): ParsedFunction {
    return this.astCompiler.compile(text);
  }
}

function parse(expr?: string | Function): ParsedFunction {
  switch (typeof expr) {
    case 'string':
      const lexer = new Lexer();
      const parser = new Parser(lexer);
      return parser.parse(expr);
    case 'function':
      return expr;
    default:
      return _.noop;
  }
}

type ParsedFunction = (scope?: any, locals?: any) => any;
export default parse;
