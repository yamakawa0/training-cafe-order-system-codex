function requireField(value, name) {
  if (value === undefined || value === null || value === '') {
    throw Object.assign(new Error(`${name} is required`), { status: 400 });
  }
}

function assertTerminal(terminal, expectedType) {
  if (!terminal || terminal.terminal_type !== expectedType) {
    throw Object.assign(new Error(`${expectedType} terminal is required`), { status: 403 });
  }
}

function assertQuantity(quantity) {
  const number = Number(quantity);
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    throw Object.assign(new Error('quantity must be 1-99'), { status: 400 });
  }
}

function assertTransition(currentStatus, nextStatus, transitions) {
  const allowed = transitions[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw Object.assign(new Error(`invalid transition: ${currentStatus} -> ${nextStatus}`), { status: 409 });
  }
}

module.exports = { requireField, assertTerminal, assertQuantity, assertTransition };
