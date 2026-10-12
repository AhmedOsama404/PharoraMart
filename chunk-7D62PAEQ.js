import{H as M,J as k,K as x,L as r,M as C}from"./chunk-YFEJXRFE.js";import{aa as z,g as I}from"./chunk-V6XIDGU7.js";import{Db as m,Eb as h,Ob as b,P as a,Pb as l,S as s,U as o,Yb as D,Za as p,bb as c,cb as v,jb as u,ma as d,pb as f,qb as g,rb as y}from"./chunk-NVCWASPR.js";var B=`
    .p-divider-horizontal {
        display: flex;
        width: 100%;
        position: relative;
        align-items: center;
        margin: dt('divider.horizontal.margin');
        padding: dt('divider.horizontal.padding');
    }

    .p-divider-horizontal:before {
        position: absolute;
        display: block;
        inset-block-start: 50%;
        inset-inline-start: 0;
        width: 100%;
        content: '';
        border-block-start: 1px solid dt('divider.border.color');
    }

    .p-divider-horizontal .p-divider-content {
        padding: dt('divider.horizontal.content.padding');
    }

    .p-divider-vertical {
        min-height: 100%;
        display: flex;
        position: relative;
        justify-content: center;
        margin: dt('divider.vertical.margin');
        padding: dt('divider.vertical.padding');
    }

    .p-divider-vertical:before {
        position: absolute;
        display: block;
        inset-block-start: 0;
        inset-inline-start: 50%;
        height: 100%;
        content: '';
        border-inline-start: 1px solid dt('divider.border.color');
    }

    .p-divider.p-divider-vertical .p-divider-content {
        padding: dt('divider.vertical.content.padding');
    }

    .p-divider-content {
        z-index: 1;
        background: dt('divider.content.background');
        color: dt('divider.content.color');
    }

    .p-divider-solid.p-divider-horizontal:before {
        border-block-start-style: solid;
    }

    .p-divider-solid.p-divider-vertical:before {
        border-inline-start-style: solid;
    }

    .p-divider-dashed.p-divider-horizontal:before {
        border-block-start-style: dashed;
    }

    .p-divider-dashed.p-divider-vertical:before {
        border-inline-start-style: dashed;
    }

    .p-divider-dotted.p-divider-horizontal:before {
        border-block-start-style: dotted;
    }

    .p-divider-dotted.p-divider-vertical:before {
        border-inline-start-style: dotted;
    }

    .p-divider-left:dir(rtl),
    .p-divider-right:dir(rtl) {
        flex-direction: row-reverse;
    }
`;var E=["*"],F={root:({instance:e})=>({justifyContent:e.layout==="horizontal"?e.align==="center"||e.align==null?"center":e.align==="left"?"flex-start":e.align==="right"?"flex-end":null:null,alignItems:e.layout==="vertical"?e.align==="center"||e.align==null?"center":e.align==="top"?"flex-start":e.align==="bottom"?"flex-end":null:null})},N={root:({instance:e})=>["p-divider p-component","p-divider-"+e.layout,"p-divider-"+e.type,{"p-divider-left":e.layout==="horizontal"&&(!e.align||e.align==="left")},{"p-divider-center":e.layout==="horizontal"&&e.align==="center"},{"p-divider-right":e.layout==="horizontal"&&e.align==="right"},{"p-divider-top":e.layout==="vertical"&&e.align==="top"},{"p-divider-center":e.layout==="vertical"&&(!e.align||e.align==="center")},{"p-divider-bottom":e.layout==="vertical"&&e.align==="bottom"}],content:"p-divider-content"},S=(()=>{class e extends M{name="divider";style=B;classes=N;inlineStyles=F;static \u0275fac=(()=>{let i;return function(t){return(i||(i=d(e)))(t||e)}})();static \u0275prov=a({token:e,factory:e.\u0275fac})}return e})();var j=new s("DIVIDER_INSTANCE"),X=(()=>{class e extends x{$pcDivider=o(j,{optional:!0,skipSelf:!0})??void 0;bindDirectiveInstance=o(r,{self:!0});onAfterViewChecked(){this.bindDirectiveInstance.setAttrs(this.ptms(["host","root"]))}styleClass;layout="horizontal";type="solid";align;_componentStyle=o(S);static \u0275fac=(()=>{let i;return function(t){return(i||(i=d(e)))(t||e)}})();static \u0275cmp=p({type:e,selectors:[["p-divider"]],hostAttrs:["role","separator"],hostVars:5,hostBindings:function(n,t){n&2&&(u("aria-orientation",t.layout),b(t.sx("root")),l(t.cn(t.cx("root"),t.styleClass)))},inputs:{styleClass:"styleClass",layout:"layout",type:"type",align:"align"},features:[D([S,{provide:j,useExisting:e},{provide:k,useExisting:e}]),v([r]),c],ngContentSelectors:E,decls:2,vars:3,consts:[[3,"pBind"]],template:function(n,t){n&1&&(m(),g(0,"div",0),h(1),y()),n&2&&(l(t.cx("content")),f("pBind",t.ptm("content")))},dependencies:[I,z,C,r],encapsulation:2,changeDetection:0})}return e})();export{X as a};
