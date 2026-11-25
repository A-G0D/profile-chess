import test from "node:test";
import assert from "node:assert/strict";
import { parseClick } from "../src/lib.js";

test("parseClick accepts two ints in range", () => {
  assert.deepEqual(parseClick("?399,200"), { x: 399, y: 200 });
  assert.deepEqual(parseClick("0,0"), { x: 0, y: 0 });
});
test("parseClick rejects garbage", () => {
  for (const s of ["", "?", "?1", "?1,2,3", "?a,b", "?-1,5", "?1.5,2", "?800,10", "?10,440", "?400,10", "?10,400", "?99999,1", "?1,2&x=3", "?%31,2", null, undefined])
    assert.equal(parseClick(s), null, String(s));
});
