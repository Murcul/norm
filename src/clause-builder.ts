import { SupportedTypes } from './types.ts';

type PartialRecord<K extends keyof any, T> = {
  [P in K]?: T[];
};

type ConjunctionType = 'OR' | 'AND';

const logicalOperatorMapping: Record<'_and' | '_or', ConjunctionType> = {
  _and: 'AND',
  _or: 'OR',
};

type ObjectClauseFields<Tkey extends string | number | symbol, TValue> =
  PartialRecord<Tkey, TValue>;

export type WhereClauseInput<Tkey extends string | number | symbol, TValue> =
  & { [P in Tkey]?: TValue[] }
  & {
    _or?: WhereClauseInput<Tkey, TValue>[];
    _and?: WhereClauseInput<Tkey, TValue>[];
  };

export class ClauseBuilder<T extends string | number | symbol> {
  private preparedIndex: number;
  private preparedValues: Array<SupportedTypes>;

  constructor(
    private clause: WhereClauseInput<T, SupportedTypes>,
  ) {
    this.preparedValues = [];
    this.preparedIndex = 1;
  }

  private get nextPreparedIndex() {
    return this.preparedIndex + this.preparedValues.length;
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

    return `(${clause.join(` ${conjunction} `)})`;
  }

  private appendConjunction(
    baseClause: string,
    conjunction: ConjunctionType,
    clause: string,
  ) {
    if (!baseClause) return `${clause}`;

    return `(${baseClause} ${conjunction} ${clause})`;
  }

  private buildClauses(
    clauses: WhereClauseInput<T, SupportedTypes>[],
    conjunction: ConjunctionType,
    clauseQuery = '',
  ): any {
    if (Array.isArray(clauses) && clauses.length === 0) {
      return clauseQuery;
    }
    const [firstClause, ...otherClauses] = clauses;

    const { _and, _or, ...fieldClauses } = firstClause;

    const otherClause = otherClauses.length &&
      this.buildClauses(otherClauses, conjunction, clauseQuery);
    const _andClause = _and &&
      this.buildClauses(_and, logicalOperatorMapping._and, clauseQuery);
    const _orClause = _or &&
      this.buildClauses(_or, logicalOperatorMapping._or, clauseQuery);

    const fieldClause = Object.keys(fieldClauses).length
      ? this.buildObjectClause(fieldClauses, conjunction)
      : '';

    let clause = fieldClause;

    if (_orClause) {
      clause = this.appendConjunction(clause, conjunction, _orClause);
    }

    if (_andClause) {
      clause = this.appendConjunction(clause, conjunction, _andClause);
    }

    if (otherClause) {
      clause = this.appendConjunction(clause, conjunction, otherClause);
    }

    return clause;
  }

  public buildWhereClause() {
    const whereClause = this.buildClauses(
      [this.clause],
      logicalOperatorMapping._and,
    );

    return {
      clause: whereClause,
      values: this.preparedValues,
      nextPreparedIndex: this.nextPreparedIndex,
    };
  }
}
