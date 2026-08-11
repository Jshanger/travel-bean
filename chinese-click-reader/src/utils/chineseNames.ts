import type { DictionaryEntry } from '../types'; import { getPinyin } from './pinyin';
const singleSurnames=new Set([...`赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳鲍史唐费廉岑薛雷贺倪汤滕殷罗毕郝邬安常乐于时傅皮卞齐康伍余元顾孟平黄穆萧尹姚邵汪祁毛禹狄米贝明臧计伏成戴谈宋茅庞熊纪舒屈项祝董梁杜阮蓝闵季贾路娄江童颜郭梅盛林刁钟徐邱骆高夏蔡田樊胡凌霍虞万支柯卢莫房裘缪解应宗丁宣贲邓郁单杭洪包诸左石崔吉龚程嵇邢裴陆荣翁荀羊甄曲封芮储靳汲邴糜松井段富巫乌焦巴弓牧隗山谷车侯宓蓬全郗班仰秋仲伊宫宁仇栾暴甘钭厉戎祖武符刘景詹束龙叶幸司韶郜黎蓟薄印宿白怀蒲台从鄂索咸籍赖卓蔺屠蒙池乔阴郁胥能苍双闻莘党翟谭贡劳逄姬申扶堵冉宰郦雍郤璩桑桂濮牛寿通边扈燕冀郏浦尚农温别庄晏柴瞿阎充慕连茹习艾鱼容向古易慎戈廖庾终暨居衡步都耿满弘匡国文寇广禄阙东欧利师巩聂晁勾敖融冷辛阚那简饶空曾沙养鞠须丰巢关蒯相查后荆红游竺权逯盖益桓公`]);
const compoundSurnames=['欧阳','司马','上官','诸葛','东方','皇甫','尉迟','公孙','慕容','司徒','司空','夏侯','南宫','独孤','长孙','宇文','轩辕','令狐'];
const followers=['告诉','表示','认为','觉得','说道','说','问','答','在','是','有','想','要','会','来','去','给','把','让','也','就','的','，','。','！','？','、',',','.','!','?'];
const unlikelyGivenCharacters=new Set([...`的了是在有和与及把被给让也就都而或很吗呢吧啊说问答想要会来去看听吃喝买卖学做`]);
const titleDetails = new Map([
  ['老师', { pinyin: 'lǎoshī', english: 'Teacher' }],
  ['先生', { pinyin: 'xiānsheng', english: 'Mr.' }],
  ['女士', { pinyin: 'nǚshì', english: 'Ms.' }],
  ['小姐', { pinyin: 'xiǎojiě', english: 'Miss' }],
  ['医生', { pinyin: 'yīshēng', english: 'Dr.' }],
  ['经理', { pinyin: 'jīnglǐ', english: 'Manager' }],
  ['同学', { pinyin: 'tóngxué', english: 'Classmate' }],
  ['主任', { pinyin: 'zhǔrèn', english: 'Director' }],
]);
const titlePinyin=(value:string)=>value.split(/\s+/).map(syllable=>syllable?syllable[0].toUpperCase()+syllable.slice(1):syllable).join(' ');

function capitalizedSurnamePinyin(surname: string) {
  const joined = getPinyin(surname).replace(/\s+/g, '');
  return joined ? joined[0].toUpperCase() + joined.slice(1) : surname;
}

function untonedPinyin(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function recognizeChineseName(text:string,index:number):DictionaryEntry|undefined {
  const compound=compoundSurnames.find(surname=>text.startsWith(surname,index));
  const surname=compound??(singleSurnames.has(text[index])?text[index]:undefined);
  if(!surname)return;

  const matchedTitle = [...titleDetails].find(([title]) => text.startsWith(title, index + surname.length));
  if (matchedTitle) {
    const [title, details] = matchedTitle;
    const surnamePinyin = capitalizedSurnamePinyin(surname);
    return {
      chinese: `${surname}${title}`,
      pinyin: `${surnamePinyin} ${details.pinyin}`,
      meaning: `${details.english} ${untonedPinyin(surnamePinyin)}`,
      partOfSpeech: 'person with title',
      difficultyLabel: 'Unknown',
    };
  }

  for(const givenLength of [2,1]){const end=index+surname.length+givenLength;if(end>text.length)continue;const given=text.slice(index+surname.length,end);if([...given].some(character=>unlikelyGivenCharacters.has(character)))continue;const remainder=text.slice(end);if(remainder&& !followers.some(follower=>remainder.startsWith(follower)))continue;const chinese=text.slice(index,end);const pinyin=titlePinyin(getPinyin(chinese));return{chinese,pinyin,meaning:`${pinyin} (a person’s name)`,partOfSpeech:'proper noun',difficultyLabel:'Unknown'}}
}
