function mobility (role, state) {
  var actions = findlegals(role,state,game);
  var feasibles = findactions(role,game);

  var active = findcontrol(state,game); // library as second param?
  var score = 0;

  if (active === role) {
    score = (actions.length/feasibles.length) * 100;
  } else {
    score = (100 - actions.length/feasibles.length) * 100;
  }
  return score;
}
