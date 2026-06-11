if (params().name !== undefined || params().category_id !== undefined || params().price !== undefined) {
  run(adminCreateMenuItem);
} else {
  run(adminListMenuItems);
}
