if (params().login_id !== undefined || params().display_name !== undefined || params().password !== undefined) {
  run(adminCreateUser);
} else {
  run(adminListUsers);
}
