// SPDX-License-Identifier: GPL-3.0-only
/** One foreground lease for the existing route overlay, shared by its callers.
 * Navigation, projection and Inspector changes never claim this lease. */
export class RoutingDisplay {
 private revision=0;
 owner:'routing'|'journey'|null=null;
 claim(owner:NonNullable<RoutingDisplay['owner']>){this.owner=owner;return ++this.revision;}
 current(token:number,owner:NonNullable<RoutingDisplay['owner']>){return token===this.revision&&this.owner===owner;}
 release(owner:NonNullable<RoutingDisplay['owner']>){if(this.owner!==owner)return false;this.invalidate();return true;}
 invalidate(){this.owner=null;++this.revision;}
}
