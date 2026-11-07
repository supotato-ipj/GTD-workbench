/**
 * 一个够用的 JSON Schema 子集校验器（测试用）。
 *
 * 只实现 `app/capacity.schema.json` 用到的那几个关键字：
 * `$ref`（仅 `#/$defs/…`）、`type`、`enum`、`pattern`、`minimum`、`exclusiveMinimum`、
 * `minLength`、`required`、`properties`、`additionalProperties: false`、`items`。
 *
 * 不引第三方校验库：仓库的测试依赖只有 react／react-dom／jsdom，
 * 多一个依赖就多一份装不上的风险（`npm test` 要能在裸环境跑起来）。
 */

/**
 * 值的 JSON 类型。
 * @param {unknown} value - 值。
 * @returns {string} 类型名。
 */
function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

/**
 * 值符不符合某个类型。
 * @param {unknown} value - 值。
 * @param {string} type - 类型名。
 * @returns {boolean} 符合就是 true。
 */
function matchesType(value, type) {
  const actual = typeOf(value);
  if (type === 'number') return actual === 'number' || actual === 'integer';
  if (type === 'integer') return actual === 'integer';
  return actual === type;
}

/**
 * 顺着 `$ref` 找到目标 schema。
 * @param {object} root - 根 schema。
 * @param {string} ref - 引用（`#/$defs/时刻`）。
 * @returns {object} 目标 schema。
 */
function resolveRef(root, ref) {
  let node = root;
  for (const part of String(ref).slice(2).split('/')) {
    node = node?.[part];
  }
  if (node === undefined) throw new Error(`schema 里的 $ref 指向了不存在的地方：${ref}`);
  return node;
}

/**
 * 校验一个值。
 * @param {unknown} value - 值。
 * @param {object} schema - schema（当前这一段）。
 * @param {object} root - 根 schema（解 `$ref` 用）。
 * @param {string} path - 路径（报错时好看）。
 * @param {string[]} errors - 错误收集处。
 * @returns {void}
 */
function validate(value, schema, root, path, errors) {
  if (schema === null || typeof schema !== 'object') return;
  if (typeof schema.$ref === 'string') {
    validate(value, resolveRef(root, schema.$ref), root, path, errors);
    return;
  }

  if (typeof schema.type === 'string') {
    if (!matchesType(value, schema.type)) {
      errors.push(`${path}：类型应为 ${schema.type}，实际是 ${typeOf(value)}`);
      return;
    }
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((item) => item === value)) {
    errors.push(`${path}：取值应是 ${JSON.stringify(schema.enum)} 之一`);
  }

  if (typeof value === 'string') {
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}：不匹配 ${schema.pattern}`);
    }
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${path}：长度不足 ${schema.minLength}`);
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path}：不应小于 ${schema.minimum}`);
    }
    if (typeof schema.exclusiveMinimum === 'number' && value <= schema.exclusiveMinimum) {
      errors.push(`${path}：应大于 ${schema.exclusiveMinimum}`);
    }
  }

  if (Array.isArray(value) && schema.items !== null && typeof schema.items === 'object') {
    value.forEach((item, index) => {
      validate(item, schema.items, root, `${path}[${index}]`, errors);
    });
  }

  if (typeOf(value) === 'object') {
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(`${path}：少了必填字段「${key}」`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        validate(child, properties[key], root, `${path}.${key}`, errors);
        continue;
      }
      if (schema.additionalProperties === false) {
        errors.push(`${path}：多了一个不认识的字段「${key}」`);
      }
    }
  }
}

/**
 * 按 schema 校验一个值。
 * @param {object} schema - 根 schema。
 * @param {unknown} value - 待校验的值。
 * @returns {{ valid: boolean, errors: string[] }} 结果与错误清单。
 */
export function validateAgainstSchema(schema, value) {
  const errors = [];
  validate(value, schema, schema, '值', errors);
  return { valid: errors.length === 0, errors };
}
