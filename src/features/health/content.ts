import React from "react";
import { Ionicons } from "@expo/vector-icons";

export const nutritionImages = [require("../../../assets/nutrition/young.jpg"),require("../../../assets/nutrition/middle.jpg"),require("../../../assets/nutrition/senior.jpg")];
export type AgeBand = "under20" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s" | "80s";
export const activityImages: Record<AgeBand, number[]> = {
  under20: [require("../../../assets/activity/age/under20-1.jpg"), require("../../../assets/activity/age/under20-2.jpg")],
  "20s": [require("../../../assets/activity/age/20s-1.jpg"), require("../../../assets/activity/age/20s-2.jpg")],
  "30s": [require("../../../assets/activity/age/30s-1.jpg"), require("../../../assets/activity/age/30s-2.jpg")],
  "40s": [require("../../../assets/activity/age/40s-1.jpg"), require("../../../assets/activity/age/40s-2.jpg")],
  "50s": [require("../../../assets/activity/age/50s-1.jpg"), require("../../../assets/activity/age/50s-2.jpg")],
  "60s": [require("../../../assets/activity/age/60s-1.jpg"), require("../../../assets/activity/age/60s-2.jpg")],
  "70s": [require("../../../assets/activity/age/70s-1.jpg"), require("../../../assets/activity/age/70s-2.jpg")],
  "80s": [require("../../../assets/activity/age/80s-1.jpg"), require("../../../assets/activity/age/80s-2.jpg")],
};
export type HealthAudienceGender = "female" | "male";
export type PersonalizedHealthTopic = "hypertension" | "pad";
export const personalizedHealthImages: Record<PersonalizedHealthTopic,Record<Exclude<AgeBand,"under20">,Record<HealthAudienceGender,number>>> = {
  hypertension: {
    "20s": { female: require("../../../assets/education/personalized/hypertension/20s-female.jpg"), male: require("../../../assets/education/personalized/hypertension/20s-male.jpg") },
    "30s": { female: require("../../../assets/education/personalized/hypertension/30s-female.jpg"), male: require("../../../assets/education/personalized/hypertension/30s-male.jpg") },
    "40s": { female: require("../../../assets/education/personalized/hypertension/40s-female.jpg"), male: require("../../../assets/education/personalized/hypertension/40s-male.jpg") },
    "50s": { female: require("../../../assets/education/personalized/hypertension/50s-female.jpg"), male: require("../../../assets/education/personalized/hypertension/50s-male.jpg") },
    "60s": { female: require("../../../assets/education/personalized/hypertension/60s-female.jpg"), male: require("../../../assets/education/personalized/hypertension/60s-male.jpg") },
    "70s": { female: require("../../../assets/education/personalized/hypertension/70s-female.jpg"), male: require("../../../assets/education/personalized/hypertension/70s-male.jpg") },
    "80s": { female: require("../../../assets/education/personalized/hypertension/80s-female.jpg"), male: require("../../../assets/education/personalized/hypertension/80s-male.jpg") },
  },
  pad: {
    "20s": { female: require("../../../assets/education/personalized/pad/20s-female.jpg"), male: require("../../../assets/education/personalized/pad/20s-male.jpg") },
    "30s": { female: require("../../../assets/education/personalized/pad/30s-female.jpg"), male: require("../../../assets/education/personalized/pad/30s-male.jpg") },
    "40s": { female: require("../../../assets/education/personalized/pad/40s-female.jpg"), male: require("../../../assets/education/personalized/pad/40s-male.jpg") },
    "50s": { female: require("../../../assets/education/personalized/pad/50s-female.jpg"), male: require("../../../assets/education/personalized/pad/50s-male.jpg") },
    "60s": { female: require("../../../assets/education/personalized/pad/60s-female.jpg"), male: require("../../../assets/education/personalized/pad/60s-male.jpg") },
    "70s": { female: require("../../../assets/education/personalized/pad/70s-female.jpg"), male: require("../../../assets/education/personalized/pad/70s-male.jpg") },
    "80s": { female: require("../../../assets/education/personalized/pad/80s-female.jpg"), male: require("../../../assets/education/personalized/pad/80s-male.jpg") },
  },
};
export type HealthTopic = {
  id: string;
  title: string;
  intro: string;
  image: number;
  personalized?: PersonalizedHealthTopic;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  sections: Array<{ title: string; text: string }>;
  sourceLabel: string;
  sourceURL: string;
};
export const healthTopics: HealthTopic[] = [
  { id:"hypertension", title:"Гипертоническая болезнь", intro:"Почему давление важно контролировать, даже когда ничего не болит.", image:require("../../../assets/education/hypertension.png"), personalized:"hypertension", icon:"speedometer-outline", sourceLabel:"ESC: рекомендации для пациентов по гипертонии", sourceURL:"https://www.escardio.org/guidelines/clinical-practice-guidelines/guidelines-for-patients/", sections:[
    {title:"Что это",text:"Артериальное давление может долго оставаться повышенным без заметных симптомов. Со временем это увеличивает нагрузку на сердце, сосуды, почки и мозг."},
    {title:"Что делать каждый день",text:"Измеряйте давление в спокойном состоянии и записывайте результат. Принимайте назначенные препараты регулярно. Сократите соль, не курите, поддерживайте посильную активность и нормальный вес."},
    {title:"Когда обращаться",text:"Обсудите с врачом повторяющиеся повышенные значения и индивидуальную цель давления. При боли в груди, одышке, слабости в руке или ноге, нарушении речи вызывайте 112."},
  ]},
  { id:"coronary", title:"Ишемическая болезнь сердца", intro:"Как сужение коронарных артерий влияет на питание сердечной мышцы.", image:require("../../../assets/education/coronary-disease.png"), icon:"heart-outline", sourceLabel:"ESC: хронические коронарные синдромы, 2024", sourceURL:"https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/chronic-coronary-syndromes/", sections:[
    {title:"Что это",text:"Сердечная мышца получает кровь по коронарным артериям. Атеросклеротическая бляшка может сужать их просвет, особенно заметно это при нагрузке."},
    {title:"На что обратить внимание",text:"Давление или жжение за грудиной при ходьбе, нехватка воздуха и снижение переносимости нагрузки требуют оценки врача. Симптомы могут быть нетипичными, особенно при диабете."},
    {title:"Профилактика осложнений",text:"Не курите, контролируйте давление, холестерин и сахар, двигайтесь в согласованном с врачом режиме. Лекарства и обследования подбираются индивидуально; самостоятельно отменять терапию нельзя."},
  ]},
  { id:"afib", title:"Фибрилляция предсердий", intro:"Нерегулярный ритм сердца и почему важно оценить риск инсульта.", image:require("../../../assets/education/atrial-fibrillation.png"), icon:"pulse-outline", sourceLabel:"ESC: фибрилляция предсердий, 2024", sourceURL:"https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/atrial-fibrillation/", sections:[
    {title:"Что это",text:"При фибрилляции предсердий сердечный ритм становится нерегулярным. Возможны сердцебиение, слабость и одышка, но иногда человек ничего не ощущает."},
    {title:"Главный риск",text:"У части людей повышается риск образования тромба и инсульта. Необходимость препаратов для профилактики инсульта определяет врач по совокупности факторов, а не только по частоте пульса."},
    {title:"Наблюдение",text:"Контролируйте пульс и давление, принимайте назначенные лекарства без пропусков. При внезапной слабости, перекосе лица или нарушении речи немедленно вызывайте 112."},
  ]},
  { id:"diabetes", title:"Сахарный диабет", intro:"Контроль сахара — часть защиты сердца, почек, глаз и сосудов.", image:require("../../../assets/education/diabetes.png"), icon:"water-outline", sourceLabel:"ADA: Standards of Care in Diabetes, 2026", sourceURL:"https://diabetesjournals.org/care/article/49/Supplement_1/S216/163933/10-Cardiovascular-Disease-and-Risk-Management", sections:[
    {title:"Что важно знать",text:"Диабет влияет не только на уровень глюкозы. Он связан с риском болезней сердца, почек, глаз, нервов и артерий ног, поэтому наблюдение должно быть комплексным."},
    {title:"Еда и движение",text:"Выбирайте регулярное питание с овощами, источниками белка и цельными продуктами, ограничивайте сладкие напитки и избыток переработанной еды. Объём нагрузки согласуйте с врачом, особенно при болезнях сердца или стоп."},
    {title:"Контроль",text:"С врачом определите цели глюкозы, давления и холестерина, график анализа HbA1c, оценки функции почек, глаз и стоп. Лекарства подбираются с учётом сердечно-сосудистого и почечного риска."},
  ]},
  { id:"pad", title:"Ишемия нижних конечностей", intro:"Когда артерии ног пропускают недостаточно крови и ходьба вызывает боль.", image:require("../../../assets/education/lower-limb-ischemia.png"), personalized:"pad", icon:"walk-outline", sourceLabel:"ESC: заболевания периферических артерий, 2024", sourceURL:"https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/peripheral-arterial-and-aortic-diseases/", sections:[
    {title:"Как проявляется",text:"Типичный признак — боль или усталость в икре при ходьбе, которая проходит после остановки. Возможны холодная стопа, медленное заживление ран и изменение цвета кожи."},
    {title:"Что помогает",text:"Полный отказ от курения, контроль давления, холестерина и диабета особенно важны. Регулярная программа ходьбы часто улучшает дистанцию, но её режим лучше обсудить с врачом."},
    {title:"Когда срочно",text:"Внезапная сильная боль, похолодание, бледность или потеря чувствительности ноги требуют неотложной помощи. Незаживающая рана стопы также нуждается в быстрой очной оценке."},
  ]},
  { id:"lifestyle", title:"Физическая активность и правильное питание", intro:"Как движение и повседневное питание помогают сохранять здоровье сердца и сосудов.", image:require("../../../assets/nutrition/middle.jpg"), icon:"nutrition-outline", sourceLabel:"ВОЗ: физическая активность и здоровое питание", sourceURL:"https://www.who.int/health-topics/physical-activity", sections:[
    {title:"Двигайтесь регулярно",text:"Для большинства взрослых полезны регулярная ходьба и другие посильные аэробные нагрузки. Начинайте постепенно, уменьшайте длительное сидение и добавляйте упражнения на силу и равновесие с учётом возраста и состояния здоровья."},
    {title:"Собирайте понятную тарелку",text:"Основу рациона составляют овощи, цельные продукты, бобовые, рыба и другие подходящие источники белка. Ограничивайте избыток соли, сладкие напитки, трансжиры и часто употребляемые продукты глубокой переработки."},
    {title:"Безопасность важнее рекордов",text:"При боли в груди, необычной одышке, головокружении или резком ухудшении самочувствия прекратите нагрузку и обратитесь за медицинской помощью. При хронических заболеваниях интенсивность занятий согласуйте с врачом."},
  ]},
];
export const activityBand = (age: number): AgeBand => age < 20 ? "under20" : age < 30 ? "20s" : age < 40 ? "30s" : age < 50 ? "40s" : age < 60 ? "50s" : age < 70 ? "60s" : age < 80 ? "70s" : "80s";
