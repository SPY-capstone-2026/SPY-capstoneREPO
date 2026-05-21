import { Easing } from 'react-native';

export const jellyMotion = {
  moveDuration: 255,
  stretchDuration: 72,
  restoreDuration: 110,
  moveEasing: Easing.bezier(0.2, 0.95, 0.2, 1),
  stretchEasing: Easing.out(Easing.quad),
  restoreEasing: Easing.out(Easing.cubic),
  stretchX: 1.22,
  stretchY: 0.86,
};