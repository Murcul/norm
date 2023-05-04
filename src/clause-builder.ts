import { SupportedTypes } from './types.ts';

type PartialRecord<K extends keyof any, T> = {
  [P in K]?: T;
};

type ConjunctionType = 'OR' | 'AND';
type ArrayClauseFields<Tkey extends string | number | symbol, TValue> = Array<
  PartialRecord<Tkey, TValue>
>;
type ObjectClauseFields<Tkey extends string | number | symbol, TValue> =
  PartialRecord<Tkey, Array<TValue>>;

export type ClauseFieldsGeneric<Tkey extends string | number | symbol, TValue> =
  | ObjectClauseFields<Tkey, TValue>
  | ArrayClauseFields<Tkey, TValue>;

export interface ClauseBuilderOptions {
  preparedIndex: number;
  fallbackConjunction: ConjunctionType;
}

export interface WhereClauseInput<
  TKey extends string | number | symbol,
  TValue,
> {
  _or?: ClauseFieldsGeneric<TKey, TValue>;
  _and?: ClauseFieldsGeneric<TKey, TValue>;
  [key: string]: TValue[] | any;
}

// type WhereClauseFieldsInput = WhereClauseInput;
// | { [K in Exclude<string, keyof WhereClauseInput>]: SupportedTypes[] };

export class ClauseBuilder<T extends string | number | symbol> {
  private fallbackConjunction: ConjunctionType;
  private preparedIndex: number;
  private preparedValues: Array<SupportedTypes>;
  private whereClause: string[];

  constructor(
    private clause: WhereClauseInput<T, SupportedTypes>,
    { preparedIndex, fallbackConjunction }: ClauseBuilderOptions,
  ) {
    this.preparedValues = [];
    this.whereClause = [];
    this.preparedIndex = preparedIndex;
    this.fallbackConjunction = fallbackConjunction;
  }

  private get nextPreparedIndex() {
    return this.preparedIndex + this.preparedValues.length;
  }

  private get whereClauseStr() {
    if (!this.whereClause.length) {
      return '';
    }

    if (this.whereClause.length === 1) {
      return this.whereClause[0];
    }

    return this.whereClause.map((clause) => `(${clause})`).join(' AND ');
  }

  private buildArrayClause(
    clauseFields: ArrayClauseFields<string, SupportedTypes>,
    conjunction: ConjunctionType,
    innerConjunction: ConjunctionType,
  ) {
    return clauseFields.map((field) => {
      return Object.entries(field).map(([key, value]) => {
        const sql = `"${key}" = $${this.nextPreparedIndex}`;

        this.preparedValues.push(value);

        return sql;
      }).join(` ${innerConjunction} `);
    }).map((clause) => `(${clause})`).join(` ${conjunction} `);
  }

  private buildObjectClause(
    clauseFields: ObjectClauseFields<string, SupportedTypes>,
    conjunction: ConjunctionType,
  ) {
    const clause = Object.entries(clauseFields).map(([key, values]) => {
      const fields = values?.map((value) => {
        const idx = `$${this.nextPreparedIndex}`;
        this.preparedValues.push(value);
        return idx;
      }).join(', ');

      return `"${key}" IN (${fields})`;
    });

    return `${clause.join(` ${conjunction} `)}`;
  }

  private buildArrayOrClause(
    orClause: ArrayClauseFields<string, SupportedTypes>,
  ) {
    return this.buildArrayClause(orClause, 'OR', 'AND');
  }

  private buildObjectOrClause(
    orClause: ObjectClauseFields<string, SupportedTypes>,
  ) {
    return this.buildObjectClause(orClause, 'OR');
  }

  private buildOrClause() {
    const { _or } = this.clause;

    if (!_or) {
      return;
    }

    const clause = Array.isArray(_or)
      ? this.buildArrayOrClause(_or)
      : this.buildObjectOrClause(_or);

    this.whereClause.push(clause);

    return clause;
  }

  private buildArrayAndClause(
    orClause: ArrayClauseFields<string, SupportedTypes>,
  ) {
    return this.buildArrayClause(orClause, 'AND', 'OR');
  }

  private buildObjectAndClause(
    orClause: ObjectClauseFields<string, SupportedTypes>,
  ) {
    return this.buildObjectClause(orClause, 'AND');
  }

  private buildAndClause() {
    const { _and } = this.clause;

    if (!_and) {
      return;
    }

    const clause = Array.isArray(_and)
      ? this.buildArrayAndClause(_and)
      : this.buildObjectAndClause(_and);

    this.whereClause.push(clause);

    return clause;
  }

  private buildClause() {
    const { _and, _or, ...clauses } = this.clause;

    if (!clauses || !Object.keys(clauses).length) {
      return;
    }

    const clause = this.buildObjectClause(clauses, this.fallbackConjunction);

    this.whereClause.push(clause);
  }

  public buildWhereClause() {
    if (Object.keys(this.clause).length) {
      this.buildOrClause();
      this.buildAndClause();
      this.buildClause();
    }

    return {
      clause: this.whereClause,
      clauseStr: this.whereClauseStr,
      values: this.preparedValues,
      nextPreparedIndex: this.nextPreparedIndex,
    };
  }
}
