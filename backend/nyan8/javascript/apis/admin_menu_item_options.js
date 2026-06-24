if (params().name !== undefined || params().item_id !== undefined && params().display_order !== undefined) {
  run(adminCreateMenuItemOption);
} else {
  run(adminListMenuItemOptions);
}
