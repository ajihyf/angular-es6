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
      } else if (this.ch != null && this.chIsIn('[],{}:')) {
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
  | ASTIdentifierNode;

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

class AST {
  static Program = 'Program';
  static Literal = 'Literal';
  static ArrayExpression = 'ArrayExpression';
  static ObjectExpression = 'ObjectExpression';
  static Property = 'Property';
  static Identifier = 'Identifier';

  static constants: { [key: string]: ASTLiteralNode } = {
    'null': { type: AST.Literal, value: null },
    'true': { type: AST.Literal, value: true },
    'false': { type: AST.Literal, value: false }
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

  primary(): ASTNode {
    if (this.expect('[')) {
      return this.arrayDeclaration();
    }
    if (this.expect('{')) {
      return this.object();
    }
    if (AST.constants.hasOwnProperty(this.tokens[0].text)) {
      return AST.constants[this.consume().text];
    }
    return this.constant();
  }

  peek(e: ?string): ?LexToken {
    if (this.tokens.length > 0) {
      if (this.tokens[0].text === e || !e) {
        return this.tokens[0];
      }
    }
  }

  expect(e: ?string): ?LexToken {
    if (this.tokens.length > 0) {
      if (this.tokens[0].text === e || !e) {
        return this.tokens.shift();
      }
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
  body: string[]
};

class ASTCompiler {
  state: ASTCompilerState;
  astBuilder: AST;

  constructor(astBuilder: AST) {
    this.astBuilder = astBuilder;
  }

  compile(text): Function {
    const ast: ASTNode = this.astBuilder.ast(text);
    this.state = { body: [] };
    this.recurse(ast);
    return new Function(this.state.body.join('')); // eslint-disable-line no-new-func
  }

  recurse(ast: ASTNode): any {
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
      default:
        throw new Error('Unknown ASTNode type');
    }
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
