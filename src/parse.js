/* @flow */
import _ from 'lodash';

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

const stringEscapeRegex: RegExp = /[^ a-zA-Z0-9]/g;

function stringEscapeFn(ch: string) {
  const unicode = `0000${ch.charCodeAt(0).toString(16)}`;
  return `\\u${unicode.slice(-4)}`;
}

function escape(value: any): any {
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
  ch: ?string;
  tokens: LexToken[];

  readNumber() {
    let number: string = '';
    while (this.index < this.text.length) {
      const ch = this.text.charAt(this.index).toLocaleLowerCase();
      if (ch === '.' || isNumber(ch)) {
        number += ch;
      } else {
        const nextCh = this.peek();
        const prevCh = _.last(number);
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
    let escape: boolean = false;
    while (this.index < this.text.length) {
      const ch = this.text.charAt(this.index);
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
          text: str,
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
    this.ch = null;
    this.tokens = [];

    while (this.index < this.text.length) {
      this.ch = this.text.charAt(this.index);
      if (isNumber(this.ch) ||
        (this.chIsIn('.') && isNumber(this.peek()))) {
        this.readNumber();
      } else if (this.ch != null && this.chIsIn('\'"')) {
        this.readString(this.ch);
      } else if (this.ch != null && this.chIsIn('[],{}:.()')) {
        this.tokens.push({
          text: this.ch
        });
        this.index++;
      } else if (isIdentifier(this.ch)) {
        this.readIdentifier();
      } else if (isWhiteSpace(this.ch)) {
        this.index++;
      } else {
        throw new Error(`Unexpected next character: ${this.ch}`);
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

  chIsIn(str: string) {
    if (!this.ch) return false;
    return str.indexOf(this.ch) >= 0;
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
  | ASTCallExpressionNode;

type ASTProgramNode = {
  type: 'Program',
  body: ASTNode
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
  computed: false
};

type ASTCallExpressionNode = {
  type: 'CallExpression',
  callee: ASTNode,
  arguments: ASTNode[]
};

class AST {
  static Program = 'Program';
  static Literal = 'Literal';
  static ArrayExpression = 'ArrayExpression';
  static ObjectExpression = 'ObjectExpression';
  static Property = 'Property';
  static Identifier = 'Identifier';
  static ThisExpression = 'ThisExpression';
  static MemberExpression = 'MemberExpression';
  static CallExpression = 'CallExpression';

  static constants: { [key: string]: (ASTThisExpressionNode | ASTLiteralNode) } = {
    'this': { type: 'ThisExpression' },
    'null': { type: 'Literal', value: null },
    'true': { type: 'Literal', value: true },
    'false': { type: 'Literal', value: false } // $FLOWISSUE
  };

  lexer: Lexer;
  tokens: LexToken[];

  constructor(lexer: Lexer) {
    this.lexer = lexer;
  }

  ast(text): ASTNode {
    this.tokens = this.lexer.lex(text);
    return this.program();
  }

  program(): ASTProgramNode {
    return { type: AST.Program, body: this.primary() };
  }

  computedMemberExpression(object: ASTNode): ASTMemberExpressionNode {
    const primary: ASTMemberExpressionNode = {
      type: AST.MemberExpression,
      object,
      property: this.primary(),
      computed: true
    };
    this.consume(']');
    return primary;
  }

  nonComputedMemberExpression(object: ASTNode): ASTMemberExpressionNode {
    return {
      type: AST.MemberExpression,
      object,
      property: this.identifier(),
      computed: false
    };
  }

  callExpression(callee: ASTNode): ASTCallExpressionNode {
    const callExpression: ASTCallExpressionNode = {
      type: AST.CallExpression,
      callee,
      arguments: []
    };
    if (!this.peek(')')) {
      do {
        callExpression.arguments.push(this.primary());
      } while (this.expect(','));
    }
    this.consume(')');
    return callExpression;
  }

  primary(): ASTNode {
    let primary: ASTNode;
    if (this.expect('[')) {
      primary = this.arrayDeclaration();
    } else if (this.expect('{')) {
      primary = this.object();
    } else if (AST.constants.hasOwnProperty(this.tokens[0].text)) {
      primary = AST.constants[this.consume().text];
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
        const value = this.primary();
        properties.push({
          type: AST.Property,
          key,
          value
        });
      } while (this.expect(','));
    }
    this.consume('}');
    return { type: AST.ObjectExpression, properties };
  }

  arrayDeclaration(): ASTArrayExpressionNode {
    const elements: ASTNode[] = [];
    if (!this.peek(']')) {
      do {
        if (this.peek(']')) {
          break;
        }
        elements.push(this.primary());
      } while (this.expect(','));
    }
    this.consume(']');
    return { type: AST.ArrayExpression, elements };
  }

  constant(): ASTLiteralNode {
    return { type: AST.Literal, value: this.consume().value };
  }

  identifier(): ASTIdentifierNode {
    return { type: AST.Identifier, name: this.consume().text };
  }
}

type ASTCompilerState = {
  body: string[],
  nextId: number,
  vars: string[]
};

type CallContext = {
  context?: any,
  name?: any,
  computed?: boolean
};

class ASTCompiler {
  state: ASTCompilerState;
  astBuilder: AST;

  constructor(astBuilder: AST) {
    this.astBuilder = astBuilder;
  }

  compile(text): Function {
    const ast: ASTNode = this.astBuilder.ast(text);
    this.state = { body: [], nextId: 0, vars: [] };
    this.recurse(ast);
    /* eslint-disable no-new-func */
    return new Function('s', 'l', // s means scope, l means locals
      (this.state.vars.length ? `var ${this.state.vars.join(',')};` : '') +
      this.state.body.join(''));
    /* eslint-enable no-new-func */
  }

  nextId(): string {
    const id = `$$vv${this.state.nextId++}`;
    this.state.vars.push(id);
    return id;
  }

  recurse(ast: ASTNode, inContext?: CallContext): any {
    let varId: string;
    switch (ast.type) {
      case AST.Literal:
        return escape(ast.value);
      case AST.Program:
        this.state.body.push(`return ${this.recurse(ast.body)};`);
        break;
      case AST.ArrayExpression:
        const elements = _.map(ast.elements, element => this.recurse(element));
        return `[${elements.join(',')}]`;
      case AST.ObjectExpression:
        const properties = _.map(ast.properties, property => {
          const key = property.key.type === AST.Identifier
            ? property.key.name : escape(property.key.value);
          const value = this.recurse(property.value);
          return `${key}:${value}`;
        });
        return `{${properties.join(',')}}`;
      case AST.Identifier:
        varId = this.nextId();
        this.if_(
          ASTCompiler.getHasOwnProperty('l', ast.name),
          ASTCompiler.assign(varId, ASTCompiler.nonComputedMember('l', ast.name)));
        this.if_(
          `${ASTCompiler.not(ASTCompiler.getHasOwnProperty('l', ast.name))} && s`,
          ASTCompiler.assign(varId, ASTCompiler.nonComputedMember('s', ast.name)));
        if (inContext) {
          inContext.context = `${ASTCompiler.getHasOwnProperty('l', ast.name)} ? l : s`;
          inContext.name = ast.name;
          inContext.computed = false;
        }
        return varId;
      case AST.ThisExpression:
        return 's';
      case AST.MemberExpression:
        varId = this.nextId();
        const left = this.recurse(ast.object);
        if (inContext) {
          inContext.context = left;
        }
        if (ast.computed) {
          const right = this.recurse(ast.property);
          this.if_(left,
            ASTCompiler.assign(varId,
              ASTCompiler.computedMember(left, right)));
          if (inContext) {
            inContext.computed = true;
            inContext.name = right;
          }
        } else {
          this.if_(left,
            ASTCompiler.assign(varId,
              ASTCompiler.nonComputedMember(left, ast.property.name)));
          if (inContext) {
            inContext.computed = false;
            inContext.name = ast.property.name;
          }
        }
        return varId;
      case AST.CallExpression:
        const callContext: CallContext = {};
        let callee = this.recurse(ast.callee, callContext);
        const args = _.map(ast.arguments, arg => this.recurse(arg));
        if (callContext.context && callContext.name) {
          if (callContext.computed) {
            callee = ASTCompiler.computedMember(callContext.context, callContext.name);
          } else {
            callee = ASTCompiler.nonComputedMember(callContext.context, callContext.name);
          }
        }
        return `${callee} && ${callee}(${args.join(',')})`;
      default:
        throw new Error('Unknown ASTNode type');
    }
  }

  if_(test: any, consequent: string) {
    this.state.body.push(`if(${test}){${consequent}}`);
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

  parse(text) {
    return this.astCompiler.compile(text);
  }
}

function parse(expr: string) {
  const lexer = new Lexer();
  const parser = new Parser(lexer);
  return parser.parse(expr);
}

export default parse;
