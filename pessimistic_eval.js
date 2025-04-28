function pessimistic_eval (role, state) {
    var state_value = 0;
    if (findterminalp(state, game)) {
        state_value = goal(role, state);
    }
    value(state)=state_value;
}
  