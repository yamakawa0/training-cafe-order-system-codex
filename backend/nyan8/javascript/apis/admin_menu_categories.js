if (params().name !== undefined || params().display_order !== undefined) {
  run(adminCreateMenuCategory);
} else {
  run(adminListMenuCategories);
}
