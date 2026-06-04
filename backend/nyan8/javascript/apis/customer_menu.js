const { nyanql, rows, first } = require('../lib/nyanql_client');
const { params, ok } = require('../lib/http');
const { assertTerminal, requireField } = require('../lib/validation');

module.exports = async function customerMenu(request) {
  const query = params(request);
  requireField(query.terminal_code, 'terminal_code');
  const terminal = first(await nyanql('GET', '/bootstrap', { terminal_code: query.terminal_code }));
  assertTerminal(terminal, 'customer');
  const rawRows = rows(await nyanql('GET', '/menu'));
  const categoriesById = new Map();
  for (const row of rawRows) {
    if (!categoriesById.has(row.category_id)) {
      categoriesById.set(row.category_id, {
        id: row.category_id,
        name: row.category_name,
        displayOrder: row.category_order,
        items: []
      });
    }
    const category = categoriesById.get(row.category_id);
    let item = category.items.find((candidate) => candidate.id === row.item_id);
    if (!item) {
      item = {
        id: row.item_id,
        categoryId: row.category_id,
        name: row.item_name,
        description: row.description,
        price: Number(row.price),
        taxRate: Number(row.tax_rate),
        imageUrl: row.image_url,
        kitchenStation: row.kitchen_station,
        allergyNote: row.allergy_note,
        soldOut: Boolean(row.sold_out),
        options: []
      };
      category.items.push(item);
    }
    if (row.option_id) {
      let option = item.options.find((candidate) => candidate.id === row.option_id);
      if (!option) {
        option = {
          id: row.option_id,
          name: row.option_name,
          required: Boolean(row.required),
          multiSelect: Boolean(row.multi_select),
          choices: []
        };
        item.options.push(option);
      }
      if (row.choice_id && !option.choices.some((choice) => choice.id === row.choice_id)) {
        option.choices.push({
          id: row.choice_id,
          name: row.choice_name,
          priceDelta: Number(row.price_delta)
        });
      }
    }
  }
  return ok({ categories: Array.from(categoriesById.values()) });
};
