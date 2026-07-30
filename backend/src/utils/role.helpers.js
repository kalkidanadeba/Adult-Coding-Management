const MANAGEMENT_ROLES = ['admin', 'instructor'];

const LIVE_SESSION_ROLES = ['instructor'];

const getRole = (userOrRole) => (
  typeof userOrRole === 'string' ? userOrRole : userOrRole?.role
);

const isManagementRole = (userOrRole) => MANAGEMENT_ROLES.includes(getRole(userOrRole));

module.exports = {
  MANAGEMENT_ROLES,
  LIVE_SESSION_ROLES,
  isManagementRole
};
