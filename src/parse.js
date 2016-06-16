/* @flow */
import _ from 'lodash';

function isNumber(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

type LexToken = {
  text: string,
  value?: any,
  identifier?: boolean
};

class Lexer {
  text: string;
  index: number;
  ch: string | null;
  tokens: LexToken[];

  readNumber() {
    let number: string = '';
    while (this.index < this.text.length) {
      const ch = this.text.charAt(this.index);
      if (isNumber(ch)) {
        number += ch;
      } else {
        break;
      }
      this.index++;
    }
    this.tokens.push({
      text: number,
      value: _.toNumber(number)
    });
  }

  lex(text): LexToken[] {
    this.text = text;
    this.index = 0;
    this.ch = null;
    this.tokens = [];

    while (this.index < this.text.length) {
      this.ch = this.text.charAt(this.index);
      if (isNumber(this.ch)) {
        this.readNumber();
      } else {
        throw new Error(`Unexpected next character: ${this.ch}`);
      }
    }

    return this.tokens;
  }
}

type ASTNode = ASTProgramNode | ASTLiteralNode;

type ASTProgramNode = {
  type: 'Program',
  body: ASTNode
};

type ASTLiteralNode = {
  type: 'Literal',
  value: any
};

class AST {
  lexer: Lexer;
  tokens: LexToken[];

  program(): ASTProgramNode {
    return { type: 'Program', body: this.constant() };
  }

  constant(): ASTLiteralNode {
    return { type: 'Literal', value: this.tokens[0].value || '' };
  }

  constructor(lexer: Lexer) {
    this.lexer = lexer;
  }

  ast(text): ASTNode {
    this.tokens = this.lexer.lex(text);
    return this.program();
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
      case 'Literal':
        return ast.value;
      case 'Program':
        this.state.body.push(`return ${this.recurse(ast.body)};`);
        break;
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
