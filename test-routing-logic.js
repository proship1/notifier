const { getGroupIdForUser } = require('./src/utils/userGroupRouter');

console.log('=== Testing User-Group Routing ===\n');

// Test 1: Your mapped user
const mappedUser = 'user-e8d394b0-bafb-11eb-ac73-d5dec46ffb141621687667067';
const mappedResult = getGroupIdForUser(mappedUser, 'DEFAULT_GROUP');
console.log(`Mapped user: ${mappedUser}`);
console.log(`Result: ${mappedResult}`);
console.log(`Expected: C070bd4cccee25ab3b4984f22d8c659e3`);
console.log(`✅ ${mappedResult === 'C070bd4cccee25ab3b4984f22d8c659e3' ? 'PASS' : 'FAIL'}\n`);

// Test 2: Unmapped user (should use fallback)
const unmappedUser = 'user-unknown-123456';
const unmappedResult = getGroupIdForUser(unmappedUser, 'FALLBACK_GROUP');
console.log(`Unmapped user: ${unmappedUser}`);
console.log(`Result: ${unmappedResult}`);
console.log(`Expected: FALLBACK_GROUP`);
console.log(`✅ ${unmappedResult === 'FALLBACK_GROUP' ? 'PASS' : 'FAIL'}\n`);

// Test 3: No user provided (should use fallback)
const noUserResult = getGroupIdForUser(null, 'DEFAULT_FALLBACK');
console.log(`No user: null`);
console.log(`Result: ${noUserResult}`);
console.log(`Expected: DEFAULT_FALLBACK`);
console.log(`✅ ${noUserResult === 'DEFAULT_FALLBACK' ? 'PASS' : 'FAIL'}\n`);