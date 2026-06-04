function lineSubtotal(item, selectedChoices) {
  const optionTotal = selectedChoices.reduce((sum, choice) => sum + Number(choice.priceDelta || 0), 0);
  return (Number(item.price) + optionTotal) * Number(item.quantity);
}

function taxFor(subtotal, taxRate) {
  return Math.round(subtotal * (Number(taxRate) / 100));
}

function totalize(lines) {
  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const taxAmount = lines.reduce((sum, line) => sum + line.taxAmount, 0);
  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}

module.exports = { lineSubtotal, taxFor, totalize };
