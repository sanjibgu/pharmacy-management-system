function normalizePart(value) {
  return (value || '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export function makeItemKey({ medicineName, manufacturer, category }) {
  return `${normalizePart(medicineName)}|${normalizePart(manufacturer)}|${normalizePart(category)}`
}

export function makeManufacturerKey({ name }) {
  return normalizePart(name)
}

