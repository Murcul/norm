import { SupportedTypes } from './types.ts';

type PartialRecord<K extends keyof any, T> = {
  [P in K]?: T[];
};

type ConjunctionType = 'OR' | 'AND';

const logicalOperatorMapping: Record<'_and' | '_or', ConjunctionType> = {
  _and: 'AND',
  _or: 'OR',
};

type FieldValueWithOperator<TValue> = {
  value: TValue;
  operator: string;
};

type ObjectClauseFields<Tkey extends string | number | symbol, TValue> =
  PartialRecord<Tkey, TValue | FieldValueWithOperator<TValue>>;

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
      const fields = values?.map((fieldValue) => {
        if (fieldValue == null) {
          // Handle the null or undefined fieldValue here. 
          return ''; // Currently just skips this iteration
        }
        // Check if the fieldValue includes an operator or is just a value
        const { value, operator } = typeof fieldValue === 'object' && 'operator' in fieldValue
          ? fieldValue
          : { value: fieldValue, operator: 'IN' }; // Default to 'IN' if no operator is provided (to support legacy syntax)
        
        const arrayValue = Array.isArray(value) ? value : [value];

        const idx = `$${this.nextPreparedIndex}`;
        this.preparedValues.push(value);
  
        // Return the SQL fragment for this field, using the specified operator
        if (operator.toUpperCase() === 'IN') {
          // for the in operator make an array
          const placeholders = arrayValue.map(() => idx).join(', ');
          return `"${key}" IN (${placeholders})`;
        } else {
          // For other operators, use them directly
          return `"${key}" ${operator} (${idx})`;
        }
      }).join(` ${conjunction} `);
  
      return `${fields}`;
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
