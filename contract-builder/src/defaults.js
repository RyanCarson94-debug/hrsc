export const ALL_COUNTRIES = ["United Kingdom","Germany","France","Netherlands","Belgium","Spain","Italy","Poland","Sweden","Denmark","Norway","Finland","Switzerland","Austria","Portugal","Ireland","UAE","Saudi Arabia","South Africa","Turkey","Israel","Egypt","Kenya","Hungary","Czech Republic"];

export const DEFAULT_SETTINGS = {
  entities: [
    {id:"e1",name:"CSL Behring Ltd",countries:["United Kingdom","Germany","Netherlands","Belgium","Switzerland","Austria"],shortCode:"CSL-B"},
    {id:"e2",name:"CSL Seqirus Ltd",countries:["United Kingdom","Italy","Germany"],shortCode:"CSL-S"},
    {id:"e3",name:"CSL Plasma GmbH",countries:["Germany","Austria","Hungary","Czech Republic"],shortCode:"CSL-P"},
    {id:"e4",name:"CSL Vifor Ltd",countries:["Switzerland","Austria","Germany","France"],shortCode:"CSL-V"},
  ],
  dropdowns: {
    businessUnits: [
      {id:"bu1",label:"Commercial",entityIds:["e1","e2","e3","e4"],global:false},
      {id:"bu2",label:"R&D",entityIds:["e1","e2"],global:false},
      {id:"bu3",label:"Manufacturing",entityIds:["e1","e3"],global:false},
      {id:"bu4",label:"Finance",entityIds:[],global:true},
      {id:"bu5",label:"HR",entityIds:[],global:true},
      {id:"bu6",label:"IT",entityIds:[],global:true},
      {id:"bu7",label:"Legal",entityIds:[],global:true},
      {id:"bu8",label:"Medical Affairs",entityIds:["e1","e2"],global:false},
    ],
    employmentTypes: [
      {id:"et1",label:"Full-time",global:true,entityIds:[]},
      {id:"et2",label:"Part-time",global:true,entityIds:[]},
      {id:"et3",label:"Fixed-term",global:true,entityIds:[]},
      {id:"et4",label:"Contractor",global:true,entityIds:[]},
    ],
    managerLevels: [
      {id:"ml1",label:"Individual Contributor",global:true,entityIds:[]},
      {id:"ml2",label:"Team Lead",global:true,entityIds:[]},
      {id:"ml3",label:"Manager",global:true,entityIds:[]},
      {id:"ml4",label:"Senior Manager",global:true,entityIds:[]},
      {id:"ml5",label:"Director",global:true,entityIds:[]},
      {id:"ml6",label:"VP",global:true,entityIds:[]},
      {id:"ml7",label:"SVP",global:true,entityIds:[]},
      {id:"ml8",label:"C-Suite",global:true,entityIds:[]},
    ],
  },
};

export const DEFAULT_CLAUSES = [
  {id:"c1",name:"Probationary Period – Standard",description:"3-month probation for all grades",content:"Your employment is subject to a probationary period of {{probation_months}} months commencing on your start date. During this period, either party may terminate this agreement by giving {{probation_notice_weeks}} weeks' written notice.",variables:[{key:"probation_months",label:"Probation months",type:"number"},{key:"probation_notice_weeks",label:"Notice weeks during probation",type:"number"}],tags:["probation","standard"],global:false,countries:["United Kingdom","Germany","France","Netherlands"],entityIds:["e1","e2","e3","e4"]},
  {id:"c2",name:"Probationary Period – Extended",description:"6-month probation for senior roles",content:"Your employment is subject to a probationary period of {{probation_months}} months commencing on your start date. During this period, either party may terminate this agreement by giving {{probation_notice_weeks}} weeks' written notice. A formal review will be conducted at month three.",variables:[{key:"probation_months",label:"Probation months",type:"number"},{key:"probation_notice_weeks",label:"Notice weeks during probation",type:"number"}],tags:["probation","senior"],global:false,countries:["United Kingdom","Germany"],entityIds:["e1","e2"]},
  {id:"c3",name:"Car Allowance",description:"Monthly car allowance for eligible grades",content:"In addition to your base salary, you will receive a car allowance of {{car_allowance_amount}} per month, subject to applicable tax and social security deductions. This allowance is non-pensionable.",variables:[{key:"car_allowance_amount",label:"Monthly car allowance",type:"text"}],tags:["benefits","senior"],global:false,countries:["United Kingdom"],entityIds:["e1","e2"]},
  {id:"c4",name:"Garden Leave",description:"Garden leave provision for senior roles",content:"The Company reserves the right to require you to serve some or all of your notice period on garden leave. During any period of garden leave, you will continue to receive your salary and contractual benefits but will not be required to attend the workplace or undertake any duties.",variables:[],tags:["termination","senior"],global:false,countries:["United Kingdom"],entityIds:["e1","e2"]},
  {id:"c5",name:"Notice Period – Standard",description:"Standard notice for all grades",content:"After successful completion of your probationary period, either party may terminate this agreement by giving {{notice_weeks}} weeks' written notice.",variables:[{key:"notice_weeks",label:"Notice period (weeks)",type:"number"}],tags:["notice","standard"],global:true,countries:[],entityIds:[]},
  {id:"c6",name:"Notice Period – Senior",description:"Enhanced notice for grades 5+",content:"After successful completion of your probationary period, either party may terminate this agreement by giving {{notice_months}} months' written notice. The Company reserves the right to make a payment in lieu of notice.",variables:[{key:"notice_months",label:"Notice period (months)",type:"number"}],tags:["notice","senior"],global:true,countries:[],entityIds:[]},
  {id:"c7",name:"Annual Leave – UK Standard",description:"Standard UK annual leave entitlement",content:"You are entitled to {{annual_leave_days}} days' paid annual leave per holiday year (inclusive of public holidays), pro-rated for your first and final years of employment.\n\nThe following applies during the holiday year:\n@alpha{\nLeave must be taken in the year it is accrued unless otherwise agreed in writing\nUp to {{carry_over_days}} days may be carried over by prior written agreement\nLeave taken during notice period requires manager approval\n}",variables:[{key:"annual_leave_days",label:"Annual leave days",type:"number"},{key:"carry_over_days",label:"Max carry-over days",type:"number"}],tags:["leave","uk"],global:false,countries:["United Kingdom"],entityIds:["e1","e2"]},
  {id:"c8",name:"Pay Change Addendum",description:"Standard salary change confirmation",content:"With effect from {{effective_date}}, your annual base salary will be {{new_salary}}. All other terms and conditions of your employment remain unchanged.",variables:[{key:"effective_date",label:"Effective date",type:"date"},{key:"new_salary",label:"New annual salary",type:"text"}],tags:["addendum","pay"],global:true,countries:[],entityIds:[]},
  {id:"c9",name:"Data Protection – GDPR",description:"GDPR employee data processing clause",content:"The Company processes your personal data in accordance with its Employee Privacy Notice and applicable data protection legislation, including:\n@num{\nThe UK General Data Protection Regulation (UK GDPR)\nThe Data Protection Act 2018\nAny applicable local implementing legislation\n}\n\nA copy of the Employee Privacy Notice is available on the Company intranet.",variables:[],tags:["gdpr","data"],global:false,countries:["United Kingdom","Germany","France","Netherlands","Belgium"],entityIds:["e1","e2","e3","e4"]},
];

export const DEFAULT_TEMPLATES = [
  {id:"t1",name:"UK Employment Contract",country:"United Kingdom",entityId:"e1",documentType:"contract",description:"Standard contract for UK employees, compliant with ERA 1996",numberingFormat:"hierarchical",sections:[
    {id:"s1",name:"Parties & Position",clauseId:null,level:1,required:true,ruleSlot:false,content:"This agreement is entered into between {{company_name}} (the 'Company') and {{employee_name}} ('Employee'). Your position is {{job_title}} within the {{business_unit}} business unit."},
    {id:"s2",name:"Start Date",clauseId:null,level:1,required:true,ruleSlot:false,content:"Your employment commences on {{start_date}}. Your continuous employment date is {{continuous_employment_date}}."},
    {id:"s3",name:"Probationary Period",clauseId:"c1",level:1,required:true,ruleSlot:true},
    {id:"s4",name:"Salary",clauseId:null,level:1,required:true,ruleSlot:false,content:"Your annual base salary is {{salary}}, payable monthly in arrears on the last working day of each month."},
    {id:"s5",name:"Car Allowance",clauseId:"c3",level:1,required:false,ruleSlot:true},
    {id:"s6",name:"Annual Leave",clauseId:"c7",level:1,required:true,ruleSlot:false},
    {id:"s7",name:"Notice Period",clauseId:"c5",level:1,required:true,ruleSlot:true},
    {id:"s8",name:"Garden Leave",clauseId:"c4",level:1,required:false,ruleSlot:true},
    {id:"s9",name:"Data Protection",clauseId:"c9",level:1,required:true,ruleSlot:false},
  ]},
  {id:"t2",name:"UK Employment Contract – Seqirus",country:"United Kingdom",entityId:"e2",documentType:"contract",description:"Standard contract for CSL Seqirus UK employees",numberingFormat:"hierarchical",sections:[
    {id:"s1",name:"Parties & Position",clauseId:null,level:1,required:true,ruleSlot:false,content:"This agreement is entered into between {{company_name}} (the 'Company') and {{employee_name}} ('Employee'). Your position is {{job_title}}."},
    {id:"s2",name:"Probationary Period",clauseId:"c1",level:1,required:true,ruleSlot:true},
    {id:"s3",name:"Salary",clauseId:null,level:1,required:true,ruleSlot:false,content:"Your annual base salary is {{salary}}, payable monthly in arrears."},
    {id:"s4",name:"Notice Period",clauseId:"c5",level:1,required:true,ruleSlot:true},
    {id:"s5",name:"Data Protection",clauseId:"c9",level:1,required:true,ruleSlot:false},
  ]},
  {id:"t3",name:"Pay Change Addendum",country:"__global__",entityId:"__global__",documentType:"addendum",description:"Salary change letter — all EMEA countries",numberingFormat:"none",sections:[
    {id:"s1",name:"Opening",clauseId:null,level:1,required:true,ruleSlot:false,content:"Dear {{employee_name}},\n\nWe write to confirm the following amendment to your terms and conditions of employment."},
    {id:"s2",name:"Pay Change",clauseId:"c8",level:1,required:true,ruleSlot:false},
    {id:"s3",name:"Closing",clauseId:null,level:1,required:true,ruleSlot:false,content:"Please sign and return one copy of this letter to confirm your acceptance."},
  ]},
];

export const DEFAULT_RULES = [
  {id:"r1",name:"Senior grades – Extended probation",description:"Grades 5+ receive 6-month probation",conditions:[{field:"grade",operator:"gte",value:"5"}],conditionLogic:"AND",action:{type:"replace_clause",targetTemplateId:"t1",targetSectionId:"s3",clauseId:"c2"},country:"United Kingdom",entityId:"e1",priority:1,active:true},
  {id:"r2",name:"Senior grades – Enhanced notice",description:"Grades 5+ receive enhanced notice period",conditions:[{field:"grade",operator:"gte",value:"5"}],conditionLogic:"AND",action:{type:"replace_clause",targetTemplateId:"t1",targetSectionId:"s7",clauseId:"c6"},country:"United Kingdom",entityId:"e1",priority:2,active:true},
  {id:"r3",name:"Commercial grade 6+ – Car allowance",description:"Commercial grade 6+ get car allowance",conditions:[{field:"grade",operator:"gte",value:"6"},{field:"businessUnit",operator:"equals",value:"Commercial"}],conditionLogic:"AND",action:{type:"use_clause",targetTemplateId:"t1",targetSectionId:"s5",clauseId:"c3"},country:"United Kingdom",entityId:"e1",priority:3,active:true},
  {id:"r4",name:"Senior UK – Garden leave",description:"UK grade 5+ include garden leave",conditions:[{field:"grade",operator:"gte",value:"5"}],conditionLogic:"AND",action:{type:"use_clause",targetTemplateId:"t1",targetSectionId:"s8",clauseId:"c4"},country:"United Kingdom",entityId:"e1",priority:4,active:true},
];
