import { getUtcOffsetInMinutes } from './getUtcOffset';

export let data = [
  {
    label: 'UTC (GMT+00:00)',
    tzCode: 'utc',
    name: 'UTC',
    utc: '+00:00',
    id: 0
  },
  {
    label: 'Pacific/Midway (GMT-11:00)',
    tzCode: 'pacific/midway',
    name: '(GMT-11:00) Midway',
    utc: '-11:00',
    id: 1
  },
  {
    label: 'Pacific/Niue (GMT-11:00)',
    tzCode: 'pacific/niue',
    name: '(GMT-11:00) Alofi',
    utc: '-11:00',
    id: 2
  },
  {
    label: 'Pacific/Pago_Pago (GMT-11:00)',
    tzCode: 'pacific/pago_pago',
    name: '(GMT-11:00) Pago Pago, Tāfuna, Ta`ū, Taulaga',
    utc: '-11:00',
    id: 3
  },
  {
    label: 'America/Adak (GMT-10:00)',
    tzCode: 'america/adak',
    name: '(GMT-10:00) Adak',
    utc: '-10:00',
    id: 4
  },
  {
    label: 'Pacific/Honolulu (GMT-10:00)',
    tzCode: 'pacific/honolulu',
    name: '(GMT-10:00) Honolulu, East Honolulu, Pearl City, Hilo, Kailua',
    utc: '-10:00',
    id: 5
  },
  {
    label: 'Pacific/Rarotonga (GMT-10:00)',
    tzCode: 'pacific/rarotonga',
    name: '(GMT-10:00) Avarua',
    utc: '-10:00',
    id: 6
  },
  {
    label: 'Pacific/Tahiti (GMT-10:00)',
    tzCode: 'pacific/tahiti',
    name: '(GMT-10:00) Faaa, Papeete, Punaauia, Pirae, Mahina',
    utc: '-10:00',
    id: 7
  },
  {
    label: 'Pacific/Marquesas (GMT-09:30)',
    tzCode: 'pacific/marquesas',
    name: '(GMT-09:30) Taiohae',
    utc: '-09:30',
    id: 8
  },
  {
    label: 'America/Anchorage (GMT-09:00)',
    tzCode: 'america/anchorage',
    name: '(GMT-09:00) Anchorage, Fairbanks, Eagle River, Badger, Knik-Fairview',
    utc: '-09:00',
    id: 9
  },
  {
    label: 'America/Juneau (GMT-09:00)',
    tzCode: 'america/juneau',
    name: '(GMT-09:00) Juneau',
    utc: '-09:00',
    id: 10
  },
  {
    label: 'America/Metlakatla (GMT-09:00)',
    tzCode: 'america/metlakatla',
    name: '(GMT-09:00) Metlakatla',
    utc: '-09:00',
    id: 11
  },
  {
    label: 'America/Nome (GMT-09:00)',
    tzCode: 'america/nome',
    name: '(GMT-09:00) Nome',
    utc: '-09:00',
    id: 12
  },
  {
    label: 'America/Sitka (GMT-09:00)',
    tzCode: 'america/sitka',
    name: '(GMT-09:00) Sitka, Ketchikan',
    utc: '-09:00',
    id: 13
  },
  {
    label: 'America/Yakutat (GMT-09:00)',
    tzCode: 'america/yakutat',
    name: '(GMT-09:00) Yakutat',
    utc: '-09:00',
    id: 14
  },
  {
    label: 'Pacific/Gambier (GMT-09:00)',
    tzCode: 'pacific/gambier',
    name: '(GMT-09:00) Gambier',
    utc: '-09:00',
    id: 15
  },
  {
    label: 'America/Los_Angeles (GMT-08:00)',
    tzCode: 'america/los_angeles',
    name: '(GMT-08:00) Los Angeles, San Diego, San Jose, San Francisco, Seattle',
    utc: '-08:00',
    id: 16
  },
  {
    label: 'America/Tijuana (GMT-08:00)',
    tzCode: 'america/tijuana',
    name: '(GMT-08:00) Tijuana, Mexicali, Ensenada, Rosarito, Tecate',
    utc: '-08:00',
    id: 17
  },
  {
    label: 'America/Vancouver (GMT-08:00)',
    tzCode: 'america/vancouver',
    name: '(GMT-08:00) Vancouver, Surrey, Okanagan, Victoria, Burnaby',
    utc: '-08:00',
    id: 18
  },
  {
    label: 'Pacific/Pitcairn (GMT-08:00)',
    tzCode: 'pacific/pitcairn',
    name: '(GMT-08:00) Adamstown',
    utc: '-08:00',
    id: 19
  },
  {
    label: 'America/Boise (GMT-07:00)',
    tzCode: 'america/boise',
    name: '(GMT-07:00) Boise, Meridian, Nampa, Idaho Falls, Pocatello',
    utc: '-07:00',
    id: 20
  },
  {
    label: 'America/Cambridge_Bay (GMT-07:00)',
    tzCode: 'america/cambridge_bay',
    name: '(GMT-07:00) Cambridge Bay',
    utc: '-07:00',
    id: 21
  },
  {
    label: 'America/Chihuahua (GMT-07:00)',
    tzCode: 'america/chihuahua',
    name: '(GMT-07:00) Chihuahua, Ciudad Delicias, Cuauhtémoc, Parral, Nuevo Casas Grandes',
    utc: '-07:00',
    id: 22
  },
  {
    label: 'America/Creston (GMT-07:00)',
    tzCode: 'america/creston',
    name: '(GMT-07:00) Creston',
    utc: '-07:00',
    id: 23
  },
  {
    label: 'America/Dawson (GMT-07:00)',
    tzCode: 'america/dawson',
    name: '(GMT-07:00) Dawson',
    utc: '-07:00',
    id: 24
  },
  {
    label: 'America/Dawson_Creek (GMT-07:00)',
    tzCode: 'america/dawson_creek',
    name: '(GMT-07:00) Fort St. John, Dawson Creek',
    utc: '-07:00',
    id: 25
  },
  {
    label: 'America/Denver (GMT-07:00)',
    tzCode: 'america/denver',
    name: '(GMT-07:00) Denver, El Paso, Albuquerque, Colorado Springs, Aurora',
    utc: '-07:00',
    id: 26
  },
  {
    label: 'America/Edmonton (GMT-07:00)',
    tzCode: 'america/edmonton',
    name: '(GMT-07:00) Calgary, Edmonton, Fort McMurray, Red Deer, Lethbridge',
    utc: '-07:00',
    id: 27
  },
  {
    label: 'America/Fort_Nelson (GMT-07:00)',
    tzCode: 'america/fort_nelson',
    name: '(GMT-07:00) Fort Nelson',
    utc: '-07:00',
    id: 28
  },
  {
    label: 'America/Hermosillo (GMT-07:00)',
    tzCode: 'america/hermosillo',
    name: '(GMT-07:00) Hermosillo, Ciudad Obregón, Nogales, San Luis Río Colorado, Navojoa',
    utc: '-07:00',
    id: 29
  },
  {
    label: 'America/Inuvik (GMT-07:00)',
    tzCode: 'america/inuvik',
    name: '(GMT-07:00) Inuvik',
    utc: '-07:00',
    id: 30
  },
  {
    label: 'America/Mazatlan (GMT-07:00)',
    tzCode: 'america/mazatlan',
    name: '(GMT-07:00) Culiacán, Mazatlán, Tepic, Los Mochis, La Paz',
    utc: '-07:00',
    id: 31
  },
  {
    label: 'America/Ojinaga (GMT-07:00)',
    tzCode: 'america/ojinaga',
    name: '(GMT-07:00) Ciudad Juárez, Manuel Ojinaga, Ojinaga',
    utc: '-07:00',
    id: 32
  },
  {
    label: 'America/Phoenix (GMT-07:00)',
    tzCode: 'america/phoenix',
    name: '(GMT-07:00) Phoenix, Tucson, Mesa, Chandler, Gilbert',
    utc: '-07:00',
    id: 33
  },
  {
    label: 'America/Whitehorse (GMT-07:00)',
    tzCode: 'america/whitehorse',
    name: '(GMT-07:00) Whitehorse',
    utc: '-07:00',
    id: 34
  },
  {
    label: 'America/Yellowknife (GMT-07:00)',
    tzCode: 'america/yellowknife',
    name: '(GMT-07:00) Yellowknife',
    utc: '-07:00',
    id: 35
  },
  {
    label: 'America/Bahia_Banderas (GMT-06:00)',
    tzCode: 'america/bahia_banderas',
    name: '(GMT-06:00) Mezcales, San Vicente, Bucerías, Valle de Banderas',
    utc: '-06:00',
    id: 36
  },
  {
    label: 'America/Belize (GMT-06:00)',
    tzCode: 'america/belize',
    name: '(GMT-06:00) Belize City, San Ignacio, Orange Walk, Belmopan, Dangriga',
    utc: '-06:00',
    id: 37
  },
  {
    label: 'America/Chicago (GMT-06:00)',
    tzCode: 'america/chicago',
    name: '(GMT-06:00) Chicago, Houston, San Antonio, Dallas, Austin',
    utc: '-06:00',
    id: 38
  },
  {
    label: 'America/Costa_Rica (GMT-06:00)',
    tzCode: 'america/costa_rica',
    name: '(GMT-06:00) San José, Limón, San Francisco, Alajuela, Liberia',
    utc: '-06:00',
    id: 39
  },
  {
    label: 'America/El_Salvador (GMT-06:00)',
    tzCode: 'america/el_salvador',
    name: '(GMT-06:00) San Salvador, Soyapango, Santa Ana, San Miguel, Mejicanos',
    utc: '-06:00',
    id: 40
  },
  {
    label: 'America/Guatemala (GMT-06:00)',
    tzCode: 'america/guatemala',
    name: '(GMT-06:00) Guatemala City, Mixco, Villa Nueva, Petapa, San Juan Sacatepéquez',
    utc: '-06:00',
    id: 41
  },
  {
    label: 'America/Indiana/Knox (GMT-06:00)',
    tzCode: 'america/indiana/knox',
    name: '(GMT-06:00) Knox',
    utc: '-06:00',
    id: 42
  },
  {
    label: 'America/Indiana/Tell_City (GMT-06:00)',
    tzCode: 'america/indiana/tell_city',
    name: '(GMT-06:00) Tell City',
    utc: '-06:00',
    id: 43
  },
  {
    label: 'America/Managua (GMT-06:00)',
    tzCode: 'america/managua',
    name: '(GMT-06:00) Managua, León, Masaya, Chinandega, Matagalpa',
    utc: '-06:00',
    id: 44
  },
  {
    label: 'America/Matamoros (GMT-06:00)',
    tzCode: 'america/matamoros',
    name: '(GMT-06:00) Reynosa, Heroica Matamoros, Nuevo Laredo, Piedras Negras, Ciudad Acuña',
    utc: '-06:00',
    id: 45
  },
  {
    label: 'America/Menominee (GMT-06:00)',
    tzCode: 'america/menominee',
    name: '(GMT-06:00) Menominee, Iron Mountain, Kingsford, Ironwood, Iron River',
    utc: '-06:00',
    id: 46
  },
  {
    label: 'America/Merida (GMT-06:00)',
    tzCode: 'america/merida',
    name: '(GMT-06:00) Mérida, Campeche, Ciudad del Carmen, Kanasín, Valladolid',
    utc: '-06:00',
    id: 47
  },
  {
    label: 'America/Mexico_City (GMT-06:00)',
    tzCode: 'america/mexico_city',
    name: '(GMT-06:00) Mexico City, Iztapalapa, Ecatepec de Morelos, Guadalajara, Puebla',
    utc: '-06:00',
    id: 48
  },
  {
    label: 'America/Monterrey (GMT-06:00)',
    tzCode: 'america/monterrey',
    name: '(GMT-06:00) Monterrey, Saltillo, Guadalupe, Torreón, Victoria de Durango',
    utc: '-06:00',
    id: 49
  },
  {
    label: 'America/North_Dakota/Beulah (GMT-06:00)',
    tzCode: 'america/north_dakota/beulah',
    name: '(GMT-06:00) Beulah',
    utc: '-06:00',
    id: 50
  },
  {
    label: 'America/North_Dakota/Center (GMT-06:00)',
    tzCode: 'america/north_dakota/center',
    name: '(GMT-06:00) Center',
    utc: '-06:00',
    id: 51
  },
  {
    label: 'America/North_Dakota/New_Salem (GMT-06:00)',
    tzCode: 'america/north_dakota/new_salem',
    name: '(GMT-06:00) Mandan',
    utc: '-06:00',
    id: 52
  },
  {
    label: 'America/Rainy_River (GMT-06:00)',
    tzCode: 'america/rainy_river',
    name: '(GMT-06:00) Rainy River',
    utc: '-06:00',
    id: 53
  },
  {
    label: 'America/Rankin_Inlet (GMT-06:00)',
    tzCode: 'america/rankin_inlet',
    name: '(GMT-06:00) Rankin Inlet',
    utc: '-06:00',
    id: 54
  },
  {
    label: 'America/Regina (GMT-06:00)',
    tzCode: 'america/regina',
    name: '(GMT-06:00) Saskatoon, Regina, Prince Albert, Moose Jaw, North Battleford',
    utc: '-06:00',
    id: 55
  },
  {
    label: 'America/Resolute (GMT-06:00)',
    tzCode: 'america/resolute',
    name: '(GMT-06:00) Resolute',
    utc: '-06:00',
    id: 56
  },
  {
    label: 'America/Swift_Current (GMT-06:00)',
    tzCode: 'america/swift_current',
    name: '(GMT-06:00) Swift Current',
    utc: '-06:00',
    id: 57
  },
  {
    label: 'America/Tegucigalpa (GMT-06:00)',
    tzCode: 'america/tegucigalpa',
    name: '(GMT-06:00) Tegucigalpa, San Pedro Sula, Choloma, La Ceiba, El Progreso',
    utc: '-06:00',
    id: 58
  },
  {
    label: 'America/Winnipeg (GMT-06:00)',
    tzCode: 'america/winnipeg',
    name: '(GMT-06:00) Winnipeg, Brandon, Kenora, Portage la Prairie, Thompson',
    utc: '-06:00',
    id: 59
  },
  {
    label: 'Pacific/Easter (GMT-06:00)',
    tzCode: 'pacific/easter',
    name: '(GMT-06:00) Easter',
    utc: '-06:00',
    id: 60
  },
  {
    label: 'Pacific/Galapagos (GMT-06:00)',
    tzCode: 'pacific/galapagos',
    name: '(GMT-06:00) Puerto Ayora, Puerto Baquerizo Moreno',
    utc: '-06:00',
    id: 61
  },
  {
    label: 'America/Atikokan (GMT-05:00)',
    tzCode: 'america/atikokan',
    name: '(GMT-05:00) Atikokan',
    utc: '-05:00',
    id: 62
  },
  {
    label: 'America/Bogota (GMT-05:00)',
    tzCode: 'america/bogota',
    name: '(GMT-05:00) Bogotá, Cali, Medellín, Barranquilla, Cartagena',
    utc: '-05:00',
    id: 63
  },
  {
    label: 'America/Cancun (GMT-05:00)',
    tzCode: 'america/cancun',
    name: '(GMT-05:00) Cancún, Chetumal, Playa del Carmen, Cozumel, Felipe Carrillo Puerto',
    utc: '-05:00',
    id: 64
  },
  {
    label: 'America/Cayman (GMT-05:00)',
    tzCode: 'america/cayman',
    name: '(GMT-05:00) George Town, West Bay, Bodden Town, East End, North Side',
    utc: '-05:00',
    id: 65
  },
  {
    label: 'America/Detroit (GMT-05:00)',
    tzCode: 'america/detroit',
    name: '(GMT-05:00) Detroit, Grand Rapids, Warren, Sterling Heights, Ann Arbor',
    utc: '-05:00',
    id: 66
  },
  {
    label: 'America/Eirunepe (GMT-05:00)',
    tzCode: 'america/eirunepe',
    name: '(GMT-05:00) Eirunepé, Benjamin Constant, Envira',
    utc: '-05:00',
    id: 67
  },
  {
    label: 'America/Grand_Turk (GMT-05:00)',
    tzCode: 'america/grand_turk',
    name: '(GMT-05:00) Cockburn Town',
    utc: '-05:00',
    id: 68
  },
  {
    label: 'America/Guayaquil (GMT-05:00)',
    tzCode: 'america/guayaquil',
    name: '(GMT-05:00) Guayaquil, Quito, Cuenca, Santo Domingo de los Colorados, Machala',
    utc: '-05:00',
    id: 69
  },
  {
    label: 'America/Havana (GMT-05:00)',
    tzCode: 'america/havana',
    name: '(GMT-05:00) Havana, Santiago de Cuba, Camagüey, Holguín, Guantánamo',
    utc: '-05:00',
    id: 70
  },
  {
    label: 'America/Indiana/Indianapolis (GMT-05:00)',
    tzCode: 'america/indiana/indianapolis',
    name: '(GMT-05:00) Indianapolis, Fort Wayne, South Bend, Carmel, Bloomington',
    utc: '-05:00',
    id: 71
  },
  {
    label: 'America/Indiana/Marengo (GMT-05:00)',
    tzCode: 'america/indiana/marengo',
    name: '(GMT-05:00) Marengo',
    utc: '-05:00',
    id: 72
  },
  {
    label: 'America/Indiana/Petersburg (GMT-05:00)',
    tzCode: 'america/indiana/petersburg',
    name: '(GMT-05:00) Petersburg',
    utc: '-05:00',
    id: 73
  },
  {
    label: 'America/Indiana/Vevay (GMT-05:00)',
    tzCode: 'america/indiana/vevay',
    name: '(GMT-05:00) Vevay',
    utc: '-05:00',
    id: 74
  },
  {
    label: 'America/Indiana/Vincennes (GMT-05:00)',
    tzCode: 'america/indiana/vincennes',
    name: '(GMT-05:00) Vincennes, Jasper, Washington, Huntingburg',
    utc: '-05:00',
    id: 75
  },
  {
    label: 'America/Indiana/Winamac (GMT-05:00)',
    tzCode: 'america/indiana/winamac',
    name: '(GMT-05:00) Winamac',
    utc: '-05:00',
    id: 76
  },
  {
    label: 'America/Iqaluit (GMT-05:00)',
    tzCode: 'america/iqaluit',
    name: '(GMT-05:00) Iqaluit',
    utc: '-05:00',
    id: 77
  },
  {
    label: 'America/Jamaica (GMT-05:00)',
    tzCode: 'america/jamaica',
    name: '(GMT-05:00) Kingston, New Kingston, Spanish Town, Portmore, Montego Bay',
    utc: '-05:00',
    id: 78
  },
  {
    label: 'America/Kentucky/Louisville (GMT-05:00)',
    tzCode: 'america/kentucky/louisville',
    name: '(GMT-05:00) Louisville, Jeffersonville, New Albany, Jeffersontown, Pleasure Ridge Park',
    utc: '-05:00',
    id: 79
  },
  {
    label: 'America/Kentucky/Monticello (GMT-05:00)',
    tzCode: 'america/kentucky/monticello',
    name: '(GMT-05:00) Monticello',
    utc: '-05:00',
    id: 80
  },
  {
    label: 'America/Lima (GMT-05:00)',
    tzCode: 'america/lima',
    name: '(GMT-05:00) Lima, Arequipa, Callao, Trujillo, Chiclayo',
    utc: '-05:00',
    id: 81
  },
  {
    label: 'America/Nassau (GMT-05:00)',
    tzCode: 'america/nassau',
    name: '(GMT-05:00) Nassau, Lucaya, Freeport, West End, Cooper’s Town',
    utc: '-05:00',
    id: 82
  },
  {
    label: 'America/New_York (GMT-05:00)',
    tzCode: 'america/new_york',
    name: '(GMT-05:00) New York City, Brooklyn, Queens, Philadelphia, Manhattan',
    utc: '-05:00',
    id: 83
  },
  {
    label: 'America/Nipigon (GMT-05:00)',
    tzCode: 'america/nipigon',
    name: '(GMT-05:00) Nipigon',
    utc: '-05:00',
    id: 84
  },
  {
    label: 'America/Panama (GMT-05:00)',
    tzCode: 'america/panama',
    name: '(GMT-05:00) Panamá, San Miguelito, Juan Díaz, David, Arraiján',
    utc: '-05:00',
    id: 85
  },
  {
    label: 'America/Pangnirtung (GMT-05:00)',
    tzCode: 'america/pangnirtung',
    name: '(GMT-05:00) Pangnirtung',
    utc: '-05:00',
    id: 86
  },
  {
    label: 'America/Port-au-Prince (GMT-05:00)',
    tzCode: 'america/port-au-prince',
    name: '(GMT-05:00) Port-au-Prince, Carrefour, Delmas 73, Pétionville, Port-de-Paix',
    utc: '-05:00',
    id: 87
  },
  {
    label: 'America/Rio_Branco (GMT-05:00)',
    tzCode: 'america/rio_branco',
    name: '(GMT-05:00) Rio Branco, Cruzeiro do Sul, Sena Madureira, Tarauacá, Feijó',
    utc: '-05:00',
    id: 88
  },
  {
    label: 'America/Thunder_Bay (GMT-05:00)',
    tzCode: 'america/thunder_bay',
    name: '(GMT-05:00) Thunder Bay',
    utc: '-05:00',
    id: 89
  },
  {
    label: 'America/Toronto (GMT-05:00)',
    tzCode: 'america/toronto',
    name: '(GMT-05:00) Toronto, Montréal, Ottawa, Mississauga, Québec',
    utc: '-05:00',
    id: 90
  },
  {
    label: 'America/Anguilla (GMT-04:00)',
    tzCode: 'america/anguilla',
    name: '(GMT-04:00) The Valley, Blowing Point Village, Sandy Ground Village, The Quarter, Sandy Hill',
    utc: '-04:00',
    id: 91
  },
  {
    label: 'America/Antigua (GMT-04:00)',
    tzCode: 'america/antigua',
    name: '(GMT-04:00) Saint John’s, Piggotts, Bolands, Codrington, Parham',
    utc: '-04:00',
    id: 92
  },
  {
    label: 'America/Aruba (GMT-04:00)',
    tzCode: 'america/aruba',
    name: '(GMT-04:00) Oranjestad, Tanki Leendert, San Nicolas, Santa Cruz, Paradera',
    utc: '-04:00',
    id: 93
  },
  {
    label: 'America/Asuncion (GMT-04:00)',
    tzCode: 'america/asuncion',
    name: '(GMT-04:00) Asunción, Ciudad del Este, San Lorenzo, Capiatá, Lambaré',
    utc: '-04:00',
    id: 94
  },
  {
    label: 'America/Barbados (GMT-04:00)',
    tzCode: 'america/barbados',
    name: '(GMT-04:00) Bridgetown, Speightstown, Oistins, Bathsheba, Holetown',
    utc: '-04:00',
    id: 95
  },
  {
    label: 'America/Blanc-Sablon (GMT-04:00)',
    tzCode: 'america/blanc-sablon',
    name: '(GMT-04:00) Lévis',
    utc: '-04:00',
    id: 96
  },
  {
    label: 'America/Boa_Vista (GMT-04:00)',
    tzCode: 'america/boa_vista',
    name: '(GMT-04:00) Boa Vista',
    utc: '-04:00',
    id: 97
  },
  {
    label: 'America/Campo_Grande (GMT-04:00)',
    tzCode: 'america/campo_grande',
    name: '(GMT-04:00) Campo Grande, Dourados, Corumbá, Três Lagoas, Ponta Porã',
    utc: '-04:00',
    id: 98
  },
  {
    label: 'America/Caracas (GMT-04:00)',
    tzCode: 'america/caracas',
    name: '(GMT-04:00) Caracas, Maracaibo, Maracay, Valencia, Barquisimeto',
    utc: '-04:00',
    id: 99
  },
  {
    label: 'America/Cuiaba (GMT-04:00)',
    tzCode: 'america/cuiaba',
    name: '(GMT-04:00) Cuiabá, Várzea Grande, Rondonópolis, Sinop, Barra do Garças',
    utc: '-04:00',
    id: 100
  },
  {
    label: 'America/Curacao (GMT-04:00)',
    tzCode: 'america/curacao',
    name: '(GMT-04:00) Willemstad, Sint Michiel Liber',
    utc: '-04:00',
    id: 101
  },
  {
    label: 'America/Dominica (GMT-04:00)',
    tzCode: 'america/dominica',
    name: '(GMT-04:00) Roseau, Portsmouth, Berekua, Saint Joseph, Wesley',
    utc: '-04:00',
    id: 102
  },
  {
    label: 'America/Glace_Bay (GMT-04:00)',
    tzCode: 'america/glace_bay',
    name: '(GMT-04:00) Sydney, Glace Bay, Sydney Mines',
    utc: '-04:00',
    id: 103
  },
  {
    label: 'America/Goose_Bay (GMT-04:00)',
    tzCode: 'america/goose_bay',
    name: '(GMT-04:00) Labrador City, Happy Valley-Goose Bay',
    utc: '-04:00',
    id: 104
  },
  {
    label: 'America/Grenada (GMT-04:00)',
    tzCode: 'america/grenada',
    name: "(GMT-04:00) Saint George's, Gouyave, Grenville, Victoria, Saint David’s",
    utc: '-04:00',
    id: 105
  },
  {
    label: 'America/Guadeloupe (GMT-04:00)',
    tzCode: 'america/guadeloupe',
    name: '(GMT-04:00) Les Abymes, Baie-Mahault, Le Gosier, Petit-Bourg, Sainte-Anne',
    utc: '-04:00',
    id: 106
  },
  {
    label: 'America/Guyana (GMT-04:00)',
    tzCode: 'america/guyana',
    name: '(GMT-04:00) Georgetown, Linden, New Amsterdam, Anna Regina, Bartica',
    utc: '-04:00',
    id: 107
  },
  {
    label: 'America/Halifax (GMT-04:00)',
    tzCode: 'america/halifax',
    name: '(GMT-04:00) Halifax, Dartmouth, Charlottetown, Lower Sackville, Truro',
    utc: '-04:00',
    id: 108
  },
  {
    label: 'America/Kralendijk (GMT-04:00)',
    tzCode: 'america/kralendijk',
    name: '(GMT-04:00) Kralendijk, Oranjestad, The Bottom',
    utc: '-04:00',
    id: 109
  },
  {
    label: 'America/La_Paz (GMT-04:00)',
    tzCode: 'america/la_paz',
    name: '(GMT-04:00) Santa Cruz de la Sierra, Cochabamba, La Paz, Sucre, Oruro',
    utc: '-04:00',
    id: 110
  },
  {
    label: 'America/Lower_Princes (GMT-04:00)',
    tzCode: 'america/lower_princes',
    name: '(GMT-04:00) Cul de Sac, Lower Prince’s Quarter, Koolbaai, Philipsburg',
    utc: '-04:00',
    id: 111
  },
  {
    label: 'America/Manaus (GMT-04:00)',
    tzCode: 'america/manaus',
    name: '(GMT-04:00) Manaus, Itacoatiara, Parintins, Manacapuru, Coari',
    utc: '-04:00',
    id: 112
  },
  {
    label: 'America/Marigot (GMT-04:00)',
    tzCode: 'america/marigot',
    name: '(GMT-04:00) Marigot',
    utc: '-04:00',
    id: 113
  },
  {
    label: 'America/Martinique (GMT-04:00)',
    tzCode: 'america/martinique',
    name: '(GMT-04:00) Fort-de-France, Le Lamentin, Le Robert, Sainte-Marie, Le François',
    utc: '-04:00',
    id: 114
  },
  {
    label: 'America/Moncton (GMT-04:00)',
    tzCode: 'america/moncton',
    name: '(GMT-04:00) Moncton, Saint John, Fredericton, Dieppe, Miramichi',
    utc: '-04:00',
    id: 115
  },
  {
    label: 'America/Montserrat (GMT-04:00)',
    tzCode: 'america/montserrat',
    name: '(GMT-04:00) Brades, Saint Peters, Plymouth',
    utc: '-04:00',
    id: 116
  },
  {
    label: 'America/Porto_Velho (GMT-04:00)',
    tzCode: 'america/porto_velho',
    name: '(GMT-04:00) Porto Velho, Ji Paraná, Vilhena, Ariquemes, Cacoal',
    utc: '-04:00',
    id: 117
  },
  {
    label: 'America/Port_of_Spain (GMT-04:00)',
    tzCode: 'america/port_of_spain',
    name: '(GMT-04:00) Chaguanas, Mon Repos, San Fernando, Port of Spain, Rio Claro',
    utc: '-04:00',
    id: 118
  },
  {
    label: 'America/Puerto_Rico (GMT-04:00)',
    tzCode: 'america/puerto_rico',
    name: '(GMT-04:00) San Juan, Bayamón, Carolina, Ponce, Caguas',
    utc: '-04:00',
    id: 119
  },
  {
    label: 'America/Santiago (GMT-04:00)',
    tzCode: 'america/santiago',
    name: '(GMT-04:00) Santiago, Puente Alto, Antofagasta, Viña del Mar, Valparaíso',
    utc: '-04:00',
    id: 120
  },
  {
    label: 'America/Santo_Domingo (GMT-04:00)',
    tzCode: 'america/santo_domingo',
    name: '(GMT-04:00) Santo Domingo, Santiago de los Caballeros, Santo Domingo Oeste, Santo Domingo Este, San Pedro de Macorís',
    utc: '-04:00',
    id: 121
  },
  {
    label: 'America/St_Barthelemy (GMT-04:00)',
    tzCode: 'america/st_barthelemy',
    name: '(GMT-04:00) Gustavia',
    utc: '-04:00',
    id: 122
  },
  {
    label: 'America/St_Kitts (GMT-04:00)',
    tzCode: 'america/st_kitts',
    name: '(GMT-04:00) Basseterre, Fig Tree, Market Shop, Saint Paul’s, Middle Island',
    utc: '-04:00',
    id: 123
  },
  {
    label: 'America/St_Lucia (GMT-04:00)',
    tzCode: 'america/st_lucia',
    name: '(GMT-04:00) Castries, Bisee, Vieux Fort, Micoud, Soufrière',
    utc: '-04:00',
    id: 124
  },
  {
    label: 'America/St_Thomas (GMT-04:00)',
    tzCode: 'america/st_thomas',
    name: '(GMT-04:00) Saint Croix, Charlotte Amalie, Cruz Bay',
    utc: '-04:00',
    id: 125
  },
  {
    label: 'America/St_Vincent (GMT-04:00)',
    tzCode: 'america/st_vincent',
    name: '(GMT-04:00) Kingstown, Kingstown Park, Georgetown, Barrouallie, Port Elizabeth',
    utc: '-04:00',
    id: 126
  },
  {
    label: 'America/Thule (GMT-04:00)',
    tzCode: 'america/thule',
    name: '(GMT-04:00) Thule',
    utc: '-04:00',
    id: 127
  },
  {
    label: 'America/Tortola (GMT-04:00)',
    tzCode: 'america/tortola',
    name: '(GMT-04:00) Road Town',
    utc: '-04:00',
    id: 128
  },
  {
    label: 'Atlantic/Bermuda (GMT-04:00)',
    tzCode: 'atlantic/bermuda',
    name: '(GMT-04:00) Hamilton',
    utc: '-04:00',
    id: 129
  },
  {
    label: 'America/St_Johns (GMT-03:30)',
    tzCode: 'america/st_johns',
    name: "(GMT-03:30) St. John's, Mount Pearl, Corner Brook, Conception Bay South, Bay Roberts",
    utc: '-03:30',
    id: 130
  },
  {
    label: 'America/Araguaina (GMT-03:00)',
    tzCode: 'america/araguaina',
    name: '(GMT-03:00) Palmas, Araguaína, Gurupi, Miracema do Tocantins, Porto Franco',
    utc: '-03:00',
    id: 131
  },
  {
    label: 'America/Argentina/Buenos_Aires (GMT-03:00)',
    tzCode: 'america/argentina/buenos_aires',
    name: '(GMT-03:00) Buenos Aires, La Plata, Mar del Plata, Morón, Bahía Blanca',
    utc: '-03:00',
    id: 132
  },
  {
    label: 'America/Argentina/Catamarca (GMT-03:00)',
    tzCode: 'america/argentina/catamarca',
    name: '(GMT-03:00) San Fernando del Valle de Catamarca, Trelew, Puerto Madryn, Esquel, Rawson',
    utc: '-03:00',
    id: 133
  },
  {
    label: 'America/Argentina/Cordoba (GMT-03:00)',
    tzCode: 'america/argentina/cordoba',
    name: '(GMT-03:00) Córdoba, Rosario, Santa Fe, Resistencia, Santiago del Estero',
    utc: '-03:00',
    id: 134
  },
  {
    label: 'America/Argentina/Jujuy (GMT-03:00)',
    tzCode: 'america/argentina/jujuy',
    name: '(GMT-03:00) San Salvador de Jujuy, San Pedro de Jujuy, Libertador General San Martín, Palpalá, La Quiaca',
    utc: '-03:00',
    id: 135
  },
  {
    label: 'America/Argentina/La_Rioja (GMT-03:00)',
    tzCode: 'america/argentina/la_rioja',
    name: '(GMT-03:00) La Rioja, Chilecito, Arauco, Chamical',
    utc: '-03:00',
    id: 136
  },
  {
    label: 'America/Argentina/Mendoza (GMT-03:00)',
    tzCode: 'america/argentina/mendoza',
    name: '(GMT-03:00) Mendoza, San Rafael, San Martín',
    utc: '-03:00',
    id: 137
  },
  {
    label: 'America/Argentina/Rio_Gallegos (GMT-03:00)',
    tzCode: 'america/argentina/rio_gallegos',
    name: '(GMT-03:00) Comodoro Rivadavia, Río Gallegos, Caleta Olivia, Pico Truncado, Puerto Deseado',
    utc: '-03:00',
    id: 138
  },
  {
    label: 'America/Argentina/Salta (GMT-03:00)',
    tzCode: 'america/argentina/salta',
    name: '(GMT-03:00) Salta, Neuquén, Santa Rosa, San Carlos de Bariloche, Cipolletti',
    utc: '-03:00',
    id: 139
  },
  {
    label: 'America/Argentina/San_Juan (GMT-03:00)',
    tzCode: 'america/argentina/san_juan',
    name: '(GMT-03:00) San Juan, Chimbas, Santa Lucía, Pocito, Caucete',
    utc: '-03:00',
    id: 140
  },
  {
    label: 'America/Argentina/San_Luis (GMT-03:00)',
    tzCode: 'america/argentina/san_luis',
    name: '(GMT-03:00) San Luis, Villa Mercedes, La Punta, Merlo, Justo Daract',
    utc: '-03:00',
    id: 141
  },
  {
    label: 'America/Argentina/Tucuman (GMT-03:00)',
    tzCode: 'america/argentina/tucuman',
    name: '(GMT-03:00) San Miguel de Tucumán, Yerba Buena, Tafí Viejo, Alderetes, Aguilares',
    utc: '-03:00',
    id: 142
  },
  {
    label: 'America/Argentina/Ushuaia (GMT-03:00)',
    tzCode: 'america/argentina/ushuaia',
    name: '(GMT-03:00) Ushuaia, Río Grande',
    utc: '-03:00',
    id: 143
  },
  {
    label: 'America/Bahia (GMT-03:00)',
    tzCode: 'america/bahia',
    name: '(GMT-03:00) Salvador, Feira de Santana, Vitória da Conquista, Itabuna, Camaçari',
    utc: '-03:00',
    id: 144
  },
  {
    label: 'America/Belem (GMT-03:00)',
    tzCode: 'america/belem',
    name: '(GMT-03:00) Belém, Ananindeua, Macapá, Parauapebas, Marabá',
    utc: '-03:00',
    id: 145
  },
  {
    label: 'America/Cayenne (GMT-03:00)',
    tzCode: 'america/cayenne',
    name: '(GMT-03:00) Cayenne, Matoury, Saint-Laurent-du-Maroni, Kourou, Rémire-Montjoly',
    utc: '-03:00',
    id: 146
  },
  {
    label: 'America/Fortaleza (GMT-03:00)',
    tzCode: 'america/fortaleza',
    name: '(GMT-03:00) Fortaleza, São Luís, Natal, Teresina, João Pessoa',
    utc: '-03:00',
    id: 147
  },
  {
    label: 'America/Godthab (GMT-03:00)',
    tzCode: 'america/godthab',
    name: '(GMT-03:00) Nuuk, Sisimiut, Ilulissat, Qaqortoq, Aasiaat',
    utc: '-03:00',
    id: 148
  },
  {
    label: 'America/Maceio (GMT-03:00)',
    tzCode: 'america/maceio',
    name: '(GMT-03:00) Maceió, Aracaju, Arapiraca, Nossa Senhora do Socorro, São Cristóvão',
    utc: '-03:00',
    id: 149
  },
  {
    label: 'America/Miquelon (GMT-03:00)',
    tzCode: 'america/miquelon',
    name: '(GMT-03:00) Saint-Pierre, Miquelon',
    utc: '-03:00',
    id: 150
  },
  {
    label: 'America/Montevideo (GMT-03:00)',
    tzCode: 'america/montevideo',
    name: '(GMT-03:00) Montevideo, Salto, Paysandú, Las Piedras, Rivera',
    utc: '-03:00',
    id: 151
  },
  {
    label: 'America/Paramaribo (GMT-03:00)',
    tzCode: 'america/paramaribo',
    name: '(GMT-03:00) Paramaribo, Lelydorp, Brokopondo, Nieuw Nickerie, Moengo',
    utc: '-03:00',
    id: 152
  },
  {
    label: 'America/Punta_Arenas (GMT-03:00)',
    tzCode: 'america/punta_arenas',
    name: '(GMT-03:00) Punta Arenas, Puerto Natales',
    utc: '-03:00',
    id: 153
  },
  {
    label: 'America/Recife (GMT-03:00)',
    tzCode: 'america/recife',
    name: '(GMT-03:00) Recife, Jaboatão, Jaboatão dos Guararapes, Olinda, Paulista',
    utc: '-03:00',
    id: 154
  },
  {
    label: 'America/Santarem (GMT-03:00)',
    tzCode: 'america/santarem',
    name: '(GMT-03:00) Santarém, Altamira, Itaituba, Oriximiná, Alenquer',
    utc: '-03:00',
    id: 155
  },
  {
    label: 'America/Sao_Paulo (GMT-03:00)',
    tzCode: 'america/sao_paulo',
    name: '(GMT-03:00) São Paulo, Rio de Janeiro, Belo Horizonte, Brasília, Curitiba',
    utc: '-03:00',
    id: 156
  },
  {
    label: 'Antarctica/Palmer (GMT-03:00)',
    tzCode: 'antarctica/palmer',
    name: '(GMT-03:00) Palmer',
    utc: '-03:00',
    id: 157
  },
  {
    label: 'Antarctica/Rothera (GMT-03:00)',
    tzCode: 'antarctica/rothera',
    name: '(GMT-03:00) Rothera',
    utc: '-03:00',
    id: 158
  },
  {
    label: 'Atlantic/Stanley (GMT-03:00)',
    tzCode: 'atlantic/stanley',
    name: '(GMT-03:00) Stanley',
    utc: '-03:00',
    id: 159
  },
  {
    label: 'America/Noronha (GMT-02:00)',
    tzCode: 'america/noronha',
    name: '(GMT-02:00) Itamaracá',
    utc: '-02:00',
    id: 160
  },
  {
    label: 'Atlantic/South_Georgia (GMT-02:00)',
    tzCode: 'atlantic/south_georgia',
    name: '(GMT-02:00) Grytviken',
    utc: '-02:00',
    id: 161
  },
  {
    label: 'America/Scoresbysund (GMT-01:00)',
    tzCode: 'america/scoresbysund',
    name: '(GMT-01:00) Scoresbysund',
    utc: '-01:00',
    id: 162
  },
  {
    label: 'Atlantic/Azores (GMT-01:00)',
    tzCode: 'atlantic/azores',
    name: '(GMT-01:00) Ponta Delgada, Lagoa, Angra do Heroísmo, Rosto de Cão, Rabo de Peixe',
    utc: '-01:00',
    id: 163
  },
  {
    label: 'Atlantic/Cape_Verde (GMT-01:00)',
    tzCode: 'atlantic/cape_verde',
    name: '(GMT-01:00) Praia, Mindelo, Santa Maria, Cova Figueira, Santa Cruz',
    utc: '-01:00',
    id: 164
  },
  {
    label: 'Africa/Abidjan (GMT+00:00)',
    tzCode: 'africa/abidjan',
    name: '(GMT+00:00) Abidjan, Abobo, Bouaké, Daloa, San-Pédro',
    utc: '+00:00',
    id: 165
  },
  {
    label: 'Africa/Accra (GMT+00:00)',
    tzCode: 'africa/accra',
    name: '(GMT+00:00) Accra, Kumasi, Tamale, Takoradi, Atsiaman',
    utc: '+00:00',
    id: 166
  },
  {
    label: 'Africa/Bamako (GMT+00:00)',
    tzCode: 'africa/bamako',
    name: '(GMT+00:00) Bamako, Sikasso, Mopti, Koutiala, Ségou',
    utc: '+00:00',
    id: 167
  },
  {
    label: 'Africa/Banjul (GMT+00:00)',
    tzCode: 'africa/banjul',
    name: '(GMT+00:00) Serekunda, Brikama, Bakau, Banjul, Farafenni',
    utc: '+00:00',
    id: 168
  },
  {
    label: 'Africa/Bissau (GMT+00:00)',
    tzCode: 'africa/bissau',
    name: '(GMT+00:00) Bissau, Bafatá, Gabú, Bissorã, Bolama',
    utc: '+00:00',
    id: 169
  },
  {
    label: 'Africa/Casablanca (GMT+00:00)',
    tzCode: 'africa/casablanca',
    name: '(GMT+00:00) Casablanca, Rabat, Fès, Sale, Marrakesh',
    utc: '+00:00',
    id: 170
  },
  {
    label: 'Africa/Conakry (GMT+00:00)',
    tzCode: 'africa/conakry',
    name: '(GMT+00:00) Camayenne, Conakry, Nzérékoré, Kindia, Kankan',
    utc: '+00:00',
    id: 171
  },
  {
    label: 'Africa/Dakar (GMT+00:00)',
    tzCode: 'africa/dakar',
    name: '(GMT+00:00) Dakar, Pikine, Touba, Thiès, Thiès Nones',
    utc: '+00:00',
    id: 172
  },
  {
    label: 'Africa/El_Aaiun (GMT+00:00)',
    tzCode: 'africa/el_aaiun',
    name: '(GMT+00:00) Laayoune, Dakhla, Laayoune Plage',
    utc: '+00:00',
    id: 173
  },
  {
    label: 'Africa/Freetown (GMT+00:00)',
    tzCode: 'africa/freetown',
    name: '(GMT+00:00) Freetown, Bo, Kenema, Koidu, Makeni',
    utc: '+00:00',
    id: 174
  },
  {
    label: 'Africa/Lome (GMT+00:00)',
    tzCode: 'africa/lome',
    name: '(GMT+00:00) Lomé, Sokodé, Kara, Atakpamé, Kpalimé',
    utc: '+00:00',
    id: 175
  },
  {
    label: 'Africa/Monrovia (GMT+00:00)',
    tzCode: 'africa/monrovia',
    name: '(GMT+00:00) Monrovia, Gbarnga, Kakata, Bensonville, Harper',
    utc: '+00:00',
    id: 176
  },
  {
    label: 'Africa/Nouakchott (GMT+00:00)',
    tzCode: 'africa/nouakchott',
    name: '(GMT+00:00) Nouakchott, Nouadhibou, Néma, Kaédi, Rosso',
    utc: '+00:00',
    id: 177
  },
  {
    label: 'Africa/Ouagadougou (GMT+00:00)',
    tzCode: 'africa/ouagadougou',
    name: '(GMT+00:00) Ouagadougou, Bobo-Dioulasso, Koudougou, Ouahigouya, Banfora',
    utc: '+00:00',
    id: 178
  },
  {
    label: 'Africa/Sao_Tome (GMT+00:00)',
    tzCode: 'africa/sao_tome',
    name: '(GMT+00:00) São Tomé, Santo António',
    utc: '+00:00',
    id: 179
  },
  {
    label: 'America/Danmarkshavn (GMT+00:00)',
    tzCode: 'america/danmarkshavn',
    name: '(GMT+00:00) Danmarkshavn',
    utc: '+00:00',
    id: 180
  },
  {
    label: 'Antarctica/Troll (GMT+00:00)',
    tzCode: 'antarctica/troll',
    name: '(GMT+00:00) Troll',
    utc: '+00:00',
    id: 181
  },
  {
    label: 'Atlantic/Canary (GMT+00:00)',
    tzCode: 'atlantic/canary',
    name: '(GMT+00:00) Las Palmas de Gran Canaria, Santa Cruz de Tenerife, La Laguna, Telde, Arona',
    utc: '+00:00',
    id: 182
  },
  {
    label: 'Atlantic/Faroe (GMT+00:00)',
    tzCode: 'atlantic/faroe',
    name: '(GMT+00:00) Tórshavn, Klaksvík, Fuglafjørður, Tvøroyri, Miðvágur',
    utc: '+00:00',
    id: 183
  },
  {
    label: 'Atlantic/Madeira (GMT+00:00)',
    tzCode: 'atlantic/madeira',
    name: '(GMT+00:00) Funchal, Câmara de Lobos, São Martinho, Caniço, Machico',
    utc: '+00:00',
    id: 184
  },
  {
    label: 'Atlantic/Reykjavik (GMT+00:00)',
    tzCode: 'atlantic/reykjavik',
    name: '(GMT+00:00) Reykjavík, Kópavogur, Hafnarfjörður, Akureyri, Garðabær',
    utc: '+00:00',
    id: 185
  },
  {
    label: 'Atlantic/St_Helena (GMT+00:00)',
    tzCode: 'atlantic/st_helena',
    name: '(GMT+00:00) Jamestown, Georgetown, Edinburgh of the Seven Seas',
    utc: '+00:00',
    id: 186
  },
  {
    label: 'Europe/Dublin (GMT+00:00)',
    tzCode: 'europe/dublin',
    name: '(GMT+00:00) Dublin, Cork, Luimneach, Gaillimh, Tallaght',
    utc: '+00:00',
    id: 187
  },
  {
    label: 'Europe/Guernsey (GMT+00:00)',
    tzCode: 'europe/guernsey',
    name: '(GMT+00:00) Saint Peter Port, St Martin, Saint Sampson, St Anne, Saint Saviour',
    utc: '+00:00',
    id: 188
  },
  {
    label: 'Europe/Isle_of_Man (GMT+00:00)',
    tzCode: 'europe/isle_of_man',
    name: '(GMT+00:00) Douglas, Ramsey, Peel, Port Erin, Castletown',
    utc: '+00:00',
    id: 189
  },
  {
    label: 'Europe/Jersey (GMT+00:00)',
    tzCode: 'europe/jersey',
    name: '(GMT+00:00) Saint Helier, Le Hocq',
    utc: '+00:00',
    id: 190
  },
  {
    label: 'Europe/Lisbon (GMT+00:00)',
    tzCode: 'europe/lisbon',
    name: '(GMT+00:00) Lisbon, Porto, Amadora, Braga, Setúbal',
    utc: '+00:00',
    id: 191
  },
  {
    label: 'Europe/London (GMT+00:00)',
    tzCode: 'europe/london',
    name: '(GMT+00:00) London, Birmingham, Liverpool, Sheffield, Bristol',
    utc: '+00:00',
    id: 192
  },
  {
    label: 'Africa/Algiers (GMT+01:00)',
    tzCode: 'africa/algiers',
    name: '(GMT+01:00) Algiers, Boumerdas, Oran, Tébessa, Constantine',
    utc: '+01:00',
    id: 193
  },
  {
    label: 'Africa/Bangui (GMT+01:00)',
    tzCode: 'africa/bangui',
    name: '(GMT+01:00) Bangui, Bimbo, Mbaïki, Berbérati, Kaga Bandoro',
    utc: '+01:00',
    id: 194
  },
  {
    label: 'Africa/Brazzaville (GMT+01:00)',
    tzCode: 'africa/brazzaville',
    name: '(GMT+01:00) Brazzaville, Pointe-Noire, Dolisie, Kayes, Owando',
    utc: '+01:00',
    id: 195
  },
  {
    label: 'Africa/Ceuta (GMT+01:00)',
    tzCode: 'africa/ceuta',
    name: '(GMT+01:00) Ceuta, Melilla',
    utc: '+01:00',
    id: 196
  },
  {
    label: 'Africa/Douala (GMT+01:00)',
    tzCode: 'africa/douala',
    name: '(GMT+01:00) Douala, Yaoundé, Garoua, Kousséri, Bamenda',
    utc: '+01:00',
    id: 197
  },
  {
    label: 'Africa/Kinshasa (GMT+01:00)',
    tzCode: 'africa/kinshasa',
    name: '(GMT+01:00) Kinshasa, Masina, Kikwit, Mbandaka, Matadi',
    utc: '+01:00',
    id: 198
  },
  {
    label: 'Africa/Lagos (GMT+01:00)',
    tzCode: 'africa/lagos',
    name: '(GMT+01:00) Lagos, Kano, Ibadan, Kaduna, Port Harcourt',
    utc: '+01:00',
    id: 199
  },
  {
    label: 'Africa/Libreville (GMT+01:00)',
    tzCode: 'africa/libreville',
    name: '(GMT+01:00) Libreville, Port-Gentil, Franceville, Oyem, Moanda',
    utc: '+01:00',
    id: 200
  },
  {
    label: 'Africa/Luanda (GMT+01:00)',
    tzCode: 'africa/luanda',
    name: '(GMT+01:00) Luanda, N’dalatando, Huambo, Lobito, Benguela',
    utc: '+01:00',
    id: 201
  },
  {
    label: 'Africa/Malabo (GMT+01:00)',
    tzCode: 'africa/malabo',
    name: '(GMT+01:00) Bata, Malabo, Ebebiyin, Aconibe, Añisoc',
    utc: '+01:00',
    id: 202
  },
  {
    label: 'Africa/Ndjamena (GMT+01:00)',
    tzCode: 'africa/ndjamena',
    name: "(GMT+01:00) N'Djamena, Moundou, Sarh, Abéché, Kelo",
    utc: '+01:00',
    id: 203
  },
  {
    label: 'Africa/Niamey (GMT+01:00)',
    tzCode: 'africa/niamey',
    name: '(GMT+01:00) Niamey, Zinder, Maradi, Agadez, Alaghsas',
    utc: '+01:00',
    id: 204
  },
  {
    label: 'Africa/Porto-Novo (GMT+01:00)',
    tzCode: 'africa/porto-novo',
    name: '(GMT+01:00) Cotonou, Abomey-Calavi, Djougou, Porto-Novo, Parakou',
    utc: '+01:00',
    id: 205
  },
  {
    label: 'Africa/Tunis (GMT+01:00)',
    tzCode: 'africa/tunis',
    name: '(GMT+01:00) Tunis, Sfax, Sousse, Kairouan, Bizerte',
    utc: '+01:00',
    id: 206
  },
  {
    label: 'Africa/Windhoek (GMT+01:00)',
    tzCode: 'africa/windhoek',
    name: '(GMT+01:00) Windhoek, Rundu, Walvis Bay, Oshakati, Swakopmund',
    utc: '+01:00',
    id: 207
  },
  {
    label: 'Arctic/Longyearbyen (GMT+01:00)',
    tzCode: 'arctic/longyearbyen',
    name: '(GMT+01:00) Longyearbyen, Olonkinbyen',
    utc: '+01:00',
    id: 208
  },
  {
    label: 'Europe/Amsterdam (GMT+01:00)',
    tzCode: 'europe/amsterdam',
    name: '(GMT+01:00) Amsterdam, Rotterdam, The Hague, Utrecht, Eindhoven',
    utc: '+01:00',
    id: 209
  },
  {
    label: 'Europe/Andorra (GMT+01:00)',
    tzCode: 'europe/andorra',
    name: '(GMT+01:00) Andorra la Vella, les Escaldes, Encamp, Sant Julià de Lòria, la Massana',
    utc: '+01:00',
    id: 210
  },
  {
    label: 'Europe/Belgrade (GMT+01:00)',
    tzCode: 'europe/belgrade',
    name: '(GMT+01:00) Belgrade, Pristina, Niš, Novi Sad, Prizren',
    utc: '+01:00',
    id: 211
  },
  {
    label: 'Europe/Berlin (GMT+01:00)',
    tzCode: 'europe/berlin',
    name: '(GMT+01:00) Berlin, Hamburg, Munich, Köln, Frankfurt am Main',
    utc: '+01:00',
    id: 212
  },
  {
    label: 'Europe/Bratislava (GMT+01:00)',
    tzCode: 'europe/bratislava',
    name: '(GMT+01:00) Bratislava, Košice, Prešov, Nitra, Žilina',
    utc: '+01:00',
    id: 213
  },
  {
    label: 'Europe/Brussels (GMT+01:00)',
    tzCode: 'europe/brussels',
    name: '(GMT+01:00) Brussels, Antwerpen, Gent, Charleroi, Liège',
    utc: '+01:00',
    id: 214
  },
  {
    label: 'Europe/Budapest (GMT+01:00)',
    tzCode: 'europe/budapest',
    name: '(GMT+01:00) Budapest, Debrecen, Miskolc, Szeged, Pécs',
    utc: '+01:00',
    id: 215
  },
  {
    label: 'Europe/Copenhagen (GMT+01:00)',
    tzCode: 'europe/copenhagen',
    name: '(GMT+01:00) Copenhagen, Århus, Odense, Aalborg, Frederiksberg',
    utc: '+01:00',
    id: 216
  },
  {
    label: 'Europe/Gibraltar (GMT+01:00)',
    tzCode: 'europe/gibraltar',
    name: '(GMT+01:00) Gibraltar',
    utc: '+01:00',
    id: 217
  },
  {
    label: 'Europe/Ljubljana (GMT+01:00)',
    tzCode: 'europe/ljubljana',
    name: '(GMT+01:00) Ljubljana, Maribor, Celje, Kranj, Velenje',
    utc: '+01:00',
    id: 218
  },
  {
    label: 'Europe/Luxembourg (GMT+01:00)',
    tzCode: 'europe/luxembourg',
    name: '(GMT+01:00) Luxembourg, Esch-sur-Alzette, Dudelange, Schifflange, Bettembourg',
    utc: '+01:00',
    id: 219
  },
  {
    label: 'Europe/Madrid (GMT+01:00)',
    tzCode: 'europe/madrid',
    name: '(GMT+01:00) Madrid, Barcelona, Valencia, Sevilla, Zaragoza',
    utc: '+01:00',
    id: 220
  },
  {
    label: 'Europe/Malta (GMT+01:00)',
    tzCode: 'europe/malta',
    name: '(GMT+01:00) Birkirkara, Qormi, Mosta, Żabbar, San Pawl il-Baħar',
    utc: '+01:00',
    id: 221
  },
  {
    label: 'Europe/Monaco (GMT+01:00)',
    tzCode: 'europe/monaco',
    name: '(GMT+01:00) Monaco, Monte-Carlo, La Condamine',
    utc: '+01:00',
    id: 222
  },
  {
    label: 'Europe/Oslo (GMT+01:00)',
    tzCode: 'europe/oslo',
    name: '(GMT+01:00) Oslo, Bergen, Trondheim, Stavanger, Drammen',
    utc: '+01:00',
    id: 223
  },
  {
    label: 'Europe/Paris (GMT+01:00)',
    tzCode: 'europe/paris',
    name: '(GMT+01:00) Paris, Marseille, Lyon, Toulouse, Nice',
    utc: '+01:00',
    id: 224
  },
  {
    label: 'Europe/Podgorica (GMT+01:00)',
    tzCode: 'europe/podgorica',
    name: '(GMT+01:00) Podgorica, Nikšić, Herceg Novi, Pljevlja, Budva',
    utc: '+01:00',
    id: 225
  },
  {
    label: 'Europe/Prague (GMT+01:00)',
    tzCode: 'europe/prague',
    name: '(GMT+01:00) Prague, Brno, Ostrava, Pilsen, Olomouc',
    utc: '+01:00',
    id: 226
  },
  {
    label: 'Europe/Rome (GMT+01:00)',
    tzCode: 'europe/rome',
    name: '(GMT+01:00) Rome, Milan, Naples, Turin, Palermo',
    utc: '+01:00',
    id: 227
  },
  {
    label: 'Europe/San_Marino (GMT+01:00)',
    tzCode: 'europe/san_marino',
    name: '(GMT+01:00) Serravalle, Borgo Maggiore, San Marino, Domagnano, Fiorentino',
    utc: '+01:00',
    id: 228
  },
  {
    label: 'Europe/Sarajevo (GMT+01:00)',
    tzCode: 'europe/sarajevo',
    name: '(GMT+01:00) Sarajevo, Banja Luka, Zenica, Tuzla, Mostar',
    utc: '+01:00',
    id: 229
  },
  {
    label: 'Europe/Skopje (GMT+01:00)',
    tzCode: 'europe/skopje',
    name: '(GMT+01:00) Skopje, Bitola, Kumanovo, Prilep, Tetovo',
    utc: '+01:00',
    id: 230
  },
  {
    label: 'Europe/Stockholm (GMT+01:00)',
    tzCode: 'europe/stockholm',
    name: '(GMT+01:00) Stockholm, Göteborg, Malmö, Uppsala, Sollentuna',
    utc: '+01:00',
    id: 231
  },
  {
    label: 'Europe/Tirane (GMT+01:00)',
    tzCode: 'europe/tirane',
    name: '(GMT+01:00) Tirana, Durrës, Elbasan, Vlorë, Shkodër',
    utc: '+01:00',
    id: 232
  },
  {
    label: 'Europe/Vaduz (GMT+01:00)',
    tzCode: 'europe/vaduz',
    name: '(GMT+01:00) Schaan, Vaduz, Triesen, Balzers, Eschen',
    utc: '+01:00',
    id: 233
  },
  {
    label: 'Europe/Vatican (GMT+01:00)',
    tzCode: 'europe/vatican',
    name: '(GMT+01:00) Vatican City',
    utc: '+01:00',
    id: 234
  },
  {
    label: 'Europe/Vienna (GMT+01:00)',
    tzCode: 'europe/vienna',
    name: '(GMT+01:00) Vienna, Graz, Linz',
    utc: '+01:00',
    id: 235
  },
  {
    label: 'Europe/Warsaw (GMT+01:00)',
    tzCode: 'europe/warsaw',
    name: '(GMT+01:00) Warsaw, Łódź, Kraków, Wrocław, Poznań',
    utc: '+01:00',
    id: 236
  },
  {
    label: 'Europe/Zagreb (GMT+01:00)',
    tzCode: 'europe/zagreb',
    name: '(GMT+01:00) Zagreb, Split, Rijeka, Osijek, Zadar',
    utc: '+01:00',
    id: 237
  },
  {
    label: 'Europe/Zurich (GMT+01:00)',
    tzCode: 'europe/zurich',
    name: '(GMT+01:00) Zürich, Genève, Basel, Lausanne, Bern',
    utc: '+01:00',
    id: 238
  },
  {
    label: 'Africa/Blantyre (GMT+02:00)',
    tzCode: 'africa/blantyre',
    name: '(GMT+02:00) Lilongwe, Blantyre, Mzuzu, Zomba, Kasungu',
    utc: '+02:00',
    id: 239
  },
  {
    label: 'Africa/Bujumbura (GMT+02:00)',
    tzCode: 'africa/bujumbura',
    name: '(GMT+02:00) Bujumbura, Muyinga, Gitega, Ruyigi, Ngozi',
    utc: '+02:00',
    id: 240
  },
  {
    label: 'Africa/Cairo (GMT+02:00)',
    tzCode: 'africa/cairo',
    name: '(GMT+02:00) Cairo, Alexandria, Giza, Port Said, Suez',
    utc: '+02:00',
    id: 241
  },
  {
    label: 'Africa/Gaborone (GMT+02:00)',
    tzCode: 'africa/gaborone',
    name: '(GMT+02:00) Gaborone, Francistown, Molepolole, Selebi-Phikwe, Maun',
    utc: '+02:00',
    id: 242
  },
  {
    label: 'Africa/Harare (GMT+02:00)',
    tzCode: 'africa/harare',
    name: '(GMT+02:00) Harare, Bulawayo, Chitungwiza, Mutare, Gweru',
    utc: '+02:00',
    id: 243
  },
  {
    label: 'Africa/Johannesburg (GMT+02:00)',
    tzCode: 'africa/johannesburg',
    name: '(GMT+02:00) Cape Town, Durban, Johannesburg, Soweto, Pretoria',
    utc: '+02:00',
    id: 244
  },
  {
    label: 'Africa/Juba (GMT+02:00)',
    tzCode: 'africa/juba',
    name: '(GMT+02:00) Juba, Winejok, Malakal, Wau, Kuacjok',
    utc: '+02:00',
    id: 245
  },
  {
    label: 'Africa/Khartoum (GMT+02:00)',
    tzCode: 'africa/khartoum',
    name: '(GMT+02:00) Khartoum, Omdurman, Nyala, Port Sudan, Kassala',
    utc: '+02:00',
    id: 246
  },
  {
    label: 'Africa/Kigali (GMT+02:00)',
    tzCode: 'africa/kigali',
    name: '(GMT+02:00) Kigali, Butare, Gitarama, Musanze, Gisenyi',
    utc: '+02:00',
    id: 247
  },
  {
    label: 'Africa/Lubumbashi (GMT+02:00)',
    tzCode: 'africa/lubumbashi',
    name: '(GMT+02:00) Lubumbashi, Mbuji-Mayi, Kisangani, Kananga, Likasi',
    utc: '+02:00',
    id: 248
  },
  {
    label: 'Africa/Lusaka (GMT+02:00)',
    tzCode: 'africa/lusaka',
    name: '(GMT+02:00) Lusaka, Kitwe, Ndola, Kabwe, Chingola',
    utc: '+02:00',
    id: 249
  },
  {
    label: 'Africa/Maputo (GMT+02:00)',
    tzCode: 'africa/maputo',
    name: '(GMT+02:00) Maputo, Matola, Beira, Nampula, Chimoio',
    utc: '+02:00',
    id: 250
  },
  {
    label: 'Africa/Maseru (GMT+02:00)',
    tzCode: 'africa/maseru',
    name: '(GMT+02:00) Maseru, Mafeteng, Leribe, Maputsoe, Mohale’s Hoek',
    utc: '+02:00',
    id: 251
  },
  {
    label: 'Africa/Mbabane (GMT+02:00)',
    tzCode: 'africa/mbabane',
    name: '(GMT+02:00) Manzini, Mbabane, Big Bend, Malkerns, Nhlangano',
    utc: '+02:00',
    id: 252
  },
  {
    label: 'Africa/Tripoli (GMT+02:00)',
    tzCode: 'africa/tripoli',
    name: '(GMT+02:00) Tripoli, Benghazi, Mişrātah, Tarhuna, Al Khums',
    utc: '+02:00',
    id: 253
  },
  {
    label: 'Asia/Amman (GMT+02:00)',
    tzCode: 'asia/amman',
    name: '(GMT+02:00) Amman, Zarqa, Irbid, Russeifa, Wādī as Sīr',
    utc: '+02:00',
    id: 254
  },
  {
    label: 'Asia/Beirut (GMT+02:00)',
    tzCode: 'asia/beirut',
    name: '(GMT+02:00) Beirut, Ra’s Bayrūt, Tripoli, Sidon, Tyre',
    utc: '+02:00',
    id: 255
  },
  {
    label: 'Asia/Damascus (GMT+02:00)',
    tzCode: 'asia/damascus',
    name: '(GMT+02:00) Aleppo, Damascus, Homs, Ḩamāh, Latakia',
    utc: '+02:00',
    id: 256
  },
  {
    label: 'Asia/Famagusta (GMT+02:00)',
    tzCode: 'asia/famagusta',
    name: '(GMT+02:00) Famagusta, Kyrenia, Protaras, Paralímni, Lápithos',
    utc: '+02:00',
    id: 257
  },
  {
    label: 'Asia/Gaza (GMT+02:00)',
    tzCode: 'asia/gaza',
    name: '(GMT+02:00) Gaza, Khān Yūnis, Jabālyā, Rafaḩ, Dayr al Balaḩ',
    utc: '+02:00',
    id: 258
  },
  {
    label: 'Asia/Hebron (GMT+02:00)',
    tzCode: 'asia/hebron',
    name: '(GMT+02:00) East Jerusalem, Hebron, Nablus, Battir, Ţūlkarm',
    utc: '+02:00',
    id: 259
  },
  {
    label: 'Asia/Jerusalem (GMT+02:00)',
    tzCode: 'asia/jerusalem',
    name: '(GMT+02:00) Jerusalem, Tel Aviv, West Jerusalem, Haifa, Ashdod',
    utc: '+02:00',
    id: 260
  },
  {
    label: 'Asia/Nicosia (GMT+02:00)',
    tzCode: 'asia/nicosia',
    name: '(GMT+02:00) Nicosia, Limassol, Larnaca, Stróvolos, Paphos',
    utc: '+02:00',
    id: 261
  },
  {
    label: 'Europe/Athens (GMT+02:00)',
    tzCode: 'europe/athens',
    name: '(GMT+02:00) Athens, Thessaloníki, Pátra, Piraeus, Lárisa',
    utc: '+02:00',
    id: 262
  },
  {
    label: 'Europe/Bucharest (GMT+02:00)',
    tzCode: 'europe/bucharest',
    name: '(GMT+02:00) Bucharest, Sector 3, Sector 6, Sector 2, Iaşi',
    utc: '+02:00',
    id: 263
  },
  {
    label: 'Europe/Chisinau (GMT+02:00)',
    tzCode: 'europe/chisinau',
    name: '(GMT+02:00) Chisinau, Tiraspol, Bălţi, Bender, Rîbniţa',
    utc: '+02:00',
    id: 264
  },
  {
    label: 'Europe/Helsinki (GMT+02:00)',
    tzCode: 'europe/helsinki',
    name: '(GMT+02:00) Helsinki, Espoo, Tampere, Vantaa, Turku',
    utc: '+02:00',
    id: 265
  },
  {
    label: 'Europe/Kaliningrad (GMT+02:00)',
    tzCode: 'europe/kaliningrad',
    name: '(GMT+02:00) Kaliningrad, Chernyakhovsk, Sovetsk, Baltiysk, Gusev',
    utc: '+02:00',
    id: 266
  },
  {
    label: 'Europe/Kyiv (GMT+02:00)',
    tzCode: 'europe/kyiv',
    name: '(GMT+02:00) Kyiv, Kharkiv, Donetsk, Odesa, Dnipro',
    utc: '+02:00',
    id: 267
  },
  {
    label: 'Europe/Mariehamn (GMT+02:00)',
    tzCode: 'europe/mariehamn',
    name: '(GMT+02:00) Mariehamn',
    utc: '+02:00',
    id: 268
  },
  {
    label: 'Europe/Riga (GMT+02:00)',
    tzCode: 'europe/riga',
    name: '(GMT+02:00) Riga, Daugavpils, Liepāja, Jelgava, Jūrmala',
    utc: '+02:00',
    id: 269
  },
  {
    label: 'Europe/Sofia (GMT+02:00)',
    tzCode: 'europe/sofia',
    name: '(GMT+02:00) Sofia, Plovdiv, Varna, Burgas, Ruse',
    utc: '+02:00',
    id: 270
  },
  {
    label: 'Europe/Tallinn (GMT+02:00)',
    tzCode: 'europe/tallinn',
    name: '(GMT+02:00) Tallinn, Tartu, Narva, Kohtla-Järve, Pärnu',
    utc: '+02:00',
    id: 271
  },
  {
    label: 'Europe/Uzhgorod (GMT+02:00)',
    tzCode: 'europe/uzhgorod',
    name: '(GMT+02:00) Uzhgorod, Mukachevo, Khust, Berehove, Tyachiv',
    utc: '+02:00',
    id: 272
  },
  {
    label: 'Europe/Vilnius (GMT+02:00)',
    tzCode: 'europe/vilnius',
    name: '(GMT+02:00) Vilnius, Kaunas, Klaipėda, Šiauliai, Panevėžys',
    utc: '+02:00',
    id: 273
  },
  {
    label: 'Europe/Zaporizhzhia (GMT+02:00)',
    tzCode: 'europe/zaporizhzhia',
    name: '(GMT+02:00) Luhansk, Sevastopol, Sievierodonetsk, Alchevsk, Lysychansk',
    utc: '+02:00',
    id: 274
  },
  {
    label: 'Africa/Addis_Ababa (GMT+03:00)',
    tzCode: 'africa/addis_ababa',
    name: "(GMT+03:00) Addis Ababa, Dire Dawa, Mek'ele, Nazrēt, Bahir Dar",
    utc: '+03:00',
    id: 275
  },
  {
    label: 'Africa/Asmara (GMT+03:00)',
    tzCode: 'africa/asmara',
    name: '(GMT+03:00) Asmara, Keren, Massawa, Assab, Mendefera',
    utc: '+03:00',
    id: 276
  },
  {
    label: 'Africa/Dar_es_Salaam (GMT+03:00)',
    tzCode: 'africa/dar_es_salaam',
    name: '(GMT+03:00) Dar es Salaam, Mwanza, Zanzibar, Arusha, Mbeya',
    utc: '+03:00',
    id: 277
  },
  {
    label: 'Africa/Djibouti (GMT+03:00)',
    tzCode: 'africa/djibouti',
    name: "(GMT+03:00) Djibouti, 'Ali Sabieh, Tadjourah, Obock, Dikhil",
    utc: '+03:00',
    id: 278
  },
  {
    label: 'Africa/Kampala (GMT+03:00)',
    tzCode: 'africa/kampala',
    name: '(GMT+03:00) Kampala, Gulu, Lira, Mbarara, Jinja',
    utc: '+03:00',
    id: 279
  },
  {
    label: 'Africa/Mogadishu (GMT+03:00)',
    tzCode: 'africa/mogadishu',
    name: '(GMT+03:00) Mogadishu, Hargeysa, Berbera, Kismayo, Marka',
    utc: '+03:00',
    id: 280
  },
  {
    label: 'Africa/Nairobi (GMT+03:00)',
    tzCode: 'africa/nairobi',
    name: '(GMT+03:00) Nairobi, Mombasa, Nakuru, Eldoret, Kisumu',
    utc: '+03:00',
    id: 281
  },
  {
    label: 'Antarctica/Syowa (GMT+03:00)',
    tzCode: 'antarctica/syowa',
    name: '(GMT+03:00) Syowa',
    utc: '+03:00',
    id: 282
  },
  {
    label: 'Asia/Aden (GMT+03:00)',
    tzCode: 'asia/aden',
    name: '(GMT+03:00) Sanaa, Al Ḩudaydah, Taiz, Aden, Mukalla',
    utc: '+03:00',
    id: 283
  },
  {
    label: 'Asia/Baghdad (GMT+03:00)',
    tzCode: 'asia/baghdad',
    name: '(GMT+03:00) Baghdad, Basrah, Al Mawşil al Jadīdah, Al Başrah al Qadīmah, Mosul',
    utc: '+03:00',
    id: 284
  },
  {
    label: 'Asia/Bahrain (GMT+03:00)',
    tzCode: 'asia/bahrain',
    name: '(GMT+03:00) Manama, Al Muharraq, Ar Rifā‘, Dār Kulayb, Madīnat Ḩamad',
    utc: '+03:00',
    id: 285
  },
  {
    label: 'Asia/Kuwait (GMT+03:00)',
    tzCode: 'asia/kuwait',
    name: '(GMT+03:00) Al Aḩmadī, Ḩawallī, As Sālimīyah, Şabāḩ as Sālim, Al Farwānīyah',
    utc: '+03:00',
    id: 286
  },
  {
    label: 'Asia/Qatar (GMT+03:00)',
    tzCode: 'asia/qatar',
    name: '(GMT+03:00) Doha, Ar Rayyān, Umm Şalāl Muḩammad, Al Wakrah, Al Khawr',
    utc: '+03:00',
    id: 287
  },
  {
    label: 'Asia/Riyadh (GMT+03:00)',
    tzCode: 'asia/riyadh',
    name: '(GMT+03:00) Riyadh, Jeddah, Mecca, Medina, Sulţānah',
    utc: '+03:00',
    id: 288
  },
  {
    label: 'Europe/Istanbul (GMT+03:00)',
    tzCode: 'europe/istanbul',
    name: '(GMT+03:00) Istanbul, Ankara, İzmir, Bursa, Adana',
    utc: '+03:00',
    id: 289
  },
  {
    label: 'Europe/Kirov (GMT+03:00)',
    tzCode: 'europe/kirov',
    name: '(GMT+03:00) Kirov, Kirovo-Chepetsk, Vyatskiye Polyany, Slobodskoy, Kotel’nich',
    utc: '+03:00',
    id: 290
  },
  {
    label: 'Europe/Minsk (GMT+03:00)',
    tzCode: 'europe/minsk',
    name: "(GMT+03:00) Minsk, Homyel', Mahilyow, Vitebsk, Hrodna",
    utc: '+03:00',
    id: 291
  },
  {
    label: 'Europe/Moscow (GMT+03:00)',
    tzCode: 'europe/moscow',
    name: '(GMT+03:00) Moscow, Saint Petersburg, Nizhniy Novgorod, Kazan, Rostov-na-Donu',
    utc: '+03:00',
    id: 292
  },
  {
    label: 'Europe/Simferopol (GMT+03:00)',
    tzCode: 'europe/simferopol',
    name: '(GMT+03:00) Simferopol, Kerch, Yevpatoriya, Yalta, Feodosiya',
    utc: '+03:00',
    id: 293
  },
  {
    label: 'Europe/Volgograd (GMT+03:00)',
    tzCode: 'europe/volgograd',
    name: '(GMT+03:00) Volgograd, Volzhskiy, Kamyshin, Mikhaylovka, Uryupinsk',
    utc: '+03:00',
    id: 294
  },
  {
    label: 'Indian/Antananarivo (GMT+03:00)',
    tzCode: 'indian/antananarivo',
    name: '(GMT+03:00) Antananarivo, Toamasina, Antsirabe, Fianarantsoa, Mahajanga',
    utc: '+03:00',
    id: 295
  },
  {
    label: 'Indian/Comoro (GMT+03:00)',
    tzCode: 'indian/comoro',
    name: '(GMT+03:00) Moroni, Moutsamoudou, Fomboni, Domoni, Tsimbeo',
    utc: '+03:00',
    id: 296
  },
  {
    label: 'Indian/Mayotte (GMT+03:00)',
    tzCode: 'indian/mayotte',
    name: '(GMT+03:00) Mamoudzou, Koungou, Dzaoudzi, Dembeni, Sada',
    utc: '+03:00',
    id: 297
  },
  {
    label: 'Asia/Tehran (GMT+03:30)',
    tzCode: 'asia/tehran',
    name: '(GMT+03:30) Tehran, Mashhad, Isfahan, Karaj, Tabriz',
    utc: '+03:30',
    id: 298
  },
  {
    label: 'Asia/Baku (GMT+04:00)',
    tzCode: 'asia/baku',
    name: '(GMT+04:00) Baku, Ganja, Sumqayıt, Lankaran, Yevlakh',
    utc: '+04:00',
    id: 299
  },
  {
    label: 'Asia/Dubai (GMT+04:00)',
    tzCode: 'asia/dubai',
    name: '(GMT+04:00) Dubai, Sharjah, Abu Dhabi, Ajman City, Ras Al Khaimah City',
    utc: '+04:00',
    id: 300
  },
  {
    label: 'Asia/Muscat (GMT+04:00)',
    tzCode: 'asia/muscat',
    name: '(GMT+04:00) Muscat, Seeb, Şalālah, Bawshar, Sohar',
    utc: '+04:00',
    id: 301
  },
  {
    label: 'Asia/Tbilisi (GMT+04:00)',
    tzCode: 'asia/tbilisi',
    name: '(GMT+04:00) Tbilisi, Kutaisi, Batumi, Sokhumi, Zugdidi',
    utc: '+04:00',
    id: 302
  },
  {
    label: 'Asia/Yerevan (GMT+04:00)',
    tzCode: 'asia/yerevan',
    name: '(GMT+04:00) Yerevan, Gyumri, Vanadzor, Vagharshapat, Hrazdan',
    utc: '+04:00',
    id: 303
  },
  {
    label: 'Europe/Astrakhan (GMT+04:00)',
    tzCode: 'europe/astrakhan',
    name: '(GMT+04:00) Astrakhan, Akhtubinsk, Znamensk, Kharabali, Kamyzyak',
    utc: '+04:00',
    id: 304
  },
  {
    label: 'Europe/Samara (GMT+04:00)',
    tzCode: 'europe/samara',
    name: '(GMT+04:00) Samara, Togliatti-on-the-Volga, Izhevsk, Syzran’, Novokuybyshevsk',
    utc: '+04:00',
    id: 305
  },
  {
    label: 'Europe/Saratov (GMT+04:00)',
    tzCode: 'europe/saratov',
    name: '(GMT+04:00) Saratov, Balakovo, Engel’s, Balashov, Vol’sk',
    utc: '+04:00',
    id: 306
  },
  {
    label: 'Europe/Ulyanovsk (GMT+04:00)',
    tzCode: 'europe/ulyanovsk',
    name: '(GMT+04:00) Ulyanovsk, Dimitrovgrad, Inza, Barysh, Novoul’yanovsk',
    utc: '+04:00',
    id: 307
  },
  {
    label: 'Indian/Mahe (GMT+04:00)',
    tzCode: 'indian/mahe',
    name: '(GMT+04:00) Victoria, Anse Boileau, Bel Ombre, Beau Vallon, Cascade',
    utc: '+04:00',
    id: 308
  },
  {
    label: 'Indian/Mauritius (GMT+04:00)',
    tzCode: 'indian/mauritius',
    name: '(GMT+04:00) Port Louis, Beau Bassin-Rose Hill, Vacoas, Curepipe, Quatre Bornes',
    utc: '+04:00',
    id: 309
  },
  {
    label: 'Indian/Reunion (GMT+04:00)',
    tzCode: 'indian/reunion',
    name: '(GMT+04:00) Saint-Denis, Saint-Paul, Saint-Pierre, Le Tampon, Saint-André',
    utc: '+04:00',
    id: 310
  },
  {
    label: 'Asia/Kabul (GMT+04:30)',
    tzCode: 'asia/kabul',
    name: '(GMT+04:30) Kabul, Kandahār, Mazār-e Sharīf, Herāt, Jalālābād',
    utc: '+04:30',
    id: 311
  },
  {
    label: 'Antarctica/Mawson (GMT+05:00)',
    tzCode: 'antarctica/mawson',
    name: '(GMT+05:00) Mawson',
    utc: '+05:00',
    id: 312
  },
  {
    label: 'Asia/Aqtau (GMT+05:00)',
    tzCode: 'asia/aqtau',
    name: '(GMT+05:00) Shevchenko, Zhanaozen, Beyneu, Shetpe, Yeraliyev',
    utc: '+05:00',
    id: 313
  },
  {
    label: 'Asia/Aqtobe (GMT+05:00)',
    tzCode: 'asia/aqtobe',
    name: '(GMT+05:00) Aktobe, Kandyagash, Shalqar, Khromtau, Embi',
    utc: '+05:00',
    id: 314
  },
  {
    label: 'Asia/Ashgabat (GMT+05:00)',
    tzCode: 'asia/ashgabat',
    name: '(GMT+05:00) Ashgabat, Türkmenabat, Daşoguz, Mary, Balkanabat',
    utc: '+05:00',
    id: 315
  },
  {
    label: 'Asia/Atyrau (GMT+05:00)',
    tzCode: 'asia/atyrau',
    name: '(GMT+05:00) Atyrau, Qulsary, Shalkar, Balykshi, Maqat',
    utc: '+05:00',
    id: 316
  },
  {
    label: 'Asia/Dushanbe (GMT+05:00)',
    tzCode: 'asia/dushanbe',
    name: '(GMT+05:00) Dushanbe, Khujand, Kŭlob, Bokhtar, Istaravshan',
    utc: '+05:00',
    id: 317
  },
  {
    label: 'Asia/Karachi (GMT+05:00)',
    tzCode: 'asia/karachi',
    name: '(GMT+05:00) Karachi, Lahore, Faisalabad, Rawalpindi, Multan',
    utc: '+05:00',
    id: 318
  },
  {
    label: 'Asia/Oral (GMT+05:00)',
    tzCode: 'asia/oral',
    name: '(GMT+05:00) Oral, Aqsay, Zhänibek, Tasqala, Zhumysker',
    utc: '+05:00',
    id: 319
  },
  {
    label: 'Asia/Qyzylorda (GMT+05:00)',
    tzCode: 'asia/qyzylorda',
    name: '(GMT+05:00) Kyzylorda, Baikonur, Novokazalinsk, Aral, Chiili',
    utc: '+05:00',
    id: 320
  },
  {
    label: 'Asia/Samarkand (GMT+05:00)',
    tzCode: 'asia/samarkand',
    name: '(GMT+05:00) Samarkand, Bukhara, Nukus, Qarshi, Jizzax',
    utc: '+05:00',
    id: 321
  },
  {
    label: 'Asia/Tashkent (GMT+05:00)',
    tzCode: 'asia/tashkent',
    name: '(GMT+05:00) Tashkent, Namangan, Andijon, Qo‘qon, Chirchiq',
    utc: '+05:00',
    id: 322
  },
  {
    label: 'Asia/Yekaterinburg (GMT+05:00)',
    tzCode: 'asia/yekaterinburg',
    name: '(GMT+05:00) Yekaterinburg, Chelyabinsk, Ufa, Perm, Orenburg',
    utc: '+05:00',
    id: 323
  },
  {
    label: 'Indian/Kerguelen (GMT+05:00)',
    tzCode: 'indian/kerguelen',
    name: '(GMT+05:00) Port-aux-Français',
    utc: '+05:00',
    id: 324
  },
  {
    label: 'Indian/Maldives (GMT+05:00)',
    tzCode: 'indian/maldives',
    name: '(GMT+05:00) Male, Fuvahmulah, Hithadhoo, Kulhudhuffushi, Thinadhoo',
    utc: '+05:00',
    id: 325
  },
  {
    label: 'Asia/Colombo (GMT+05:30)',
    tzCode: 'asia/colombo',
    name: '(GMT+05:30) Colombo, Dehiwala-Mount Lavinia, Moratuwa, Jaffna, Negombo',
    utc: '+05:30',
    id: 326
  },
  {
    label: 'Asia/Kolkata (GMT+05:30)',
    tzCode: 'asia/kolkata',
    name: '(GMT+05:30) Mumbai, Delhi, Bengaluru, Kolkata, Chennai',
    utc: '+05:30',
    id: 327
  },
  {
    label: 'Asia/Kathmandu (GMT+05:45)',
    tzCode: 'asia/kathmandu',
    name: '(GMT+05:45) Kathmandu, Pokhara, Pātan, Biratnagar, Birgañj',
    utc: '+05:45',
    id: 328
  },
  {
    label: 'Antarctica/Vostok (GMT+06:00)',
    tzCode: 'antarctica/vostok',
    name: '(GMT+06:00) Vostok',
    utc: '+06:00',
    id: 329
  },
  {
    label: 'Asia/Almaty (GMT+06:00)',
    tzCode: 'asia/almaty',
    name: '(GMT+06:00) Almaty, Karagandy, Shymkent, Taraz, Nur-Sultan',
    utc: '+06:00',
    id: 330
  },
  {
    label: 'Asia/Bishkek (GMT+06:00)',
    tzCode: 'asia/bishkek',
    name: '(GMT+06:00) Bishkek, Osh, Jalal-Abad, Karakol, Tokmok',
    utc: '+06:00',
    id: 331
  },
  {
    label: 'Asia/Dhaka (GMT+06:00)',
    tzCode: 'asia/dhaka',
    name: '(GMT+06:00) Dhaka, Chattogram, Khulna, Rājshāhi, Comilla',
    utc: '+06:00',
    id: 332
  },
  {
    label: 'Asia/Omsk (GMT+06:00)',
    tzCode: 'asia/omsk',
    name: '(GMT+06:00) Omsk, Tara, Kalachinsk, Znamenskoye, Tavricheskoye',
    utc: '+06:00',
    id: 333
  },
  {
    label: 'Asia/Qostanay (GMT+06:00)',
    tzCode: 'asia/qostanay',
    name: '(GMT+06:00) Kostanay, Rudnyy, Dzhetygara, Arkalyk, Lisakovsk',
    utc: '+06:00',
    id: 334
  },
  {
    label: 'Asia/Thimphu (GMT+06:00)',
    tzCode: 'asia/thimphu',
    name: '(GMT+06:00) himphu, Punākha, Tsirang, Phuntsholing, Pemagatshel',
    utc: '+06:00',
    id: 335
  },
  {
    label: 'Asia/Urumqi (GMT+06:00)',
    tzCode: 'asia/urumqi',
    name: '(GMT+06:00) Zhongshan, Ürümqi, Zhanjiang, Shihezi, Huocheng',
    utc: '+06:00',
    id: 336
  },
  {
    label: 'Indian/Chagos (GMT+06:00)',
    tzCode: 'indian/chagos',
    name: '(GMT+06:00) British Indian Ocean Territory',
    utc: '+06:00',
    id: 337
  },
  {
    label: 'Asia/Yangon (GMT+06:30)',
    tzCode: 'asia/yangon',
    name: '(GMT+06:30) Yangon, Mandalay, Nay Pyi Taw, Mawlamyine, Kyain Seikgyi Township',
    utc: '+06:30',
    id: 338
  },
  {
    label: 'Indian/Cocos (GMT+06:30)',
    tzCode: 'indian/cocos',
    name: '(GMT+06:30) West Island',
    utc: '+06:30',
    id: 339
  },
  {
    label: 'Antarctica/Davis (GMT+07:00)',
    tzCode: 'antarctica/davis',
    name: '(GMT+07:00) Davis',
    utc: '+07:00',
    id: 340
  },
  {
    label: 'Asia/Bangkok (GMT+07:00)',
    tzCode: 'asia/bangkok',
    name: '(GMT+07:00) Bangkok, Hanoi, Haiphong, Samut Prakan, Mueang Nonthaburi',
    utc: '+07:00',
    id: 341
  },
  {
    label: 'Asia/Barnaul (GMT+07:00)',
    tzCode: 'asia/barnaul',
    name: '(GMT+07:00) Barnaul, Biysk, Rubtsovsk, Novoaltaysk, Gorno-Altaysk',
    utc: '+07:00',
    id: 342
  },
  {
    label: 'Asia/Hovd (GMT+07:00)',
    tzCode: 'asia/hovd',
    name: '(GMT+07:00) Khovd, Ölgii, Ulaangom, Uliastay, Altai',
    utc: '+07:00',
    id: 343
  },
  {
    label: 'Asia/Ho_Chi_Minh (GMT+07:00)',
    tzCode: 'asia/ho_chi_minh',
    name: '(GMT+07:00) Ho Chi Minh City, Da Nang, Biên Hòa, Nha Trang, Cần Thơ',
    utc: '+07:00',
    id: 344
  },
  {
    label: 'Asia/Jakarta (GMT+07:00)',
    tzCode: 'asia/jakarta',
    name: '(GMT+07:00) Jakarta, Surabaya, Medan, Bandung, Bekasi',
    utc: '+07:00',
    id: 345
  },
  {
    label: 'Asia/Krasnoyarsk (GMT+07:00)',
    tzCode: 'asia/krasnoyarsk',
    name: '(GMT+07:00) Krasnoyarsk, Abakan, Norilsk, Achinsk, Kyzyl',
    utc: '+07:00',
    id: 346
  },
  {
    label: 'Asia/Novokuznetsk (GMT+07:00)',
    tzCode: 'asia/novokuznetsk',
    name: '(GMT+07:00) Novokuznetsk, Kemerovo, Prokop’yevsk, Leninsk-Kuznetsky, Kiselëvsk',
    utc: '+07:00',
    id: 347
  },
  {
    label: 'Asia/Novosibirsk (GMT+07:00)',
    tzCode: 'asia/novosibirsk',
    name: '(GMT+07:00) Novosibirsk, Berdsk, Iskitim, Akademgorodok, Kuybyshev',
    utc: '+07:00',
    id: 348
  },
  {
    label: 'Asia/Phnom_Penh (GMT+07:00)',
    tzCode: 'asia/phnom_penh',
    name: '(GMT+07:00) Phnom Penh, Takeo, Sihanoukville, Battambang, Siem Reap',
    utc: '+07:00',
    id: 349
  },
  {
    label: 'Asia/Pontianak (GMT+07:00)',
    tzCode: 'asia/pontianak',
    name: '(GMT+07:00) Pontianak, Tanjung Pinang, Palangkaraya, Singkawang, Sampit',
    utc: '+07:00',
    id: 350
  },
  {
    label: 'Asia/Tomsk (GMT+07:00)',
    tzCode: 'asia/tomsk',
    name: '(GMT+07:00) Tomsk, Seversk, Strezhevoy, Kolpashevo, Asino',
    utc: '+07:00',
    id: 351
  },
  {
    label: 'Asia/Vientiane (GMT+07:00)',
    tzCode: 'asia/vientiane',
    name: '(GMT+07:00) Vientiane, Pakse, Thakhèk, Savannakhet, Luang Prabang',
    utc: '+07:00',
    id: 352
  },
  {
    label: 'Indian/Christmas (GMT+07:00)',
    tzCode: 'indian/christmas',
    name: '(GMT+07:00) Flying Fish Cove',
    utc: '+07:00',
    id: 353
  },
  {
    label: 'Asia/Brunei (GMT+08:00)',
    tzCode: 'asia/brunei',
    name: '(GMT+08:00) Bandar Seri Begawan, Kuala Belait, Seria, Tutong, Bangar',
    utc: '+08:00',
    id: 354
  },
  {
    label: 'Asia/Choibalsan (GMT+08:00)',
    tzCode: 'asia/choibalsan',
    name: '(GMT+08:00) Baruun-Urt, Choibalsan',
    utc: '+08:00',
    id: 355
  },
  {
    label: 'Asia/Hong_Kong (GMT+08:00)',
    tzCode: 'asia/hong_kong',
    name: '(GMT+08:00) Hong Kong, Kowloon, Tsuen Wan, Yuen Long Kau Hui, Tung Chung',
    utc: '+08:00',
    id: 356
  },
  {
    label: 'Asia/Irkutsk (GMT+08:00)',
    tzCode: 'asia/irkutsk',
    name: '(GMT+08:00) Irkutsk, Ulan-Ude, Bratsk, Angarsk, Ust’-Ilimsk',
    utc: '+08:00',
    id: 357
  },
  {
    label: 'Asia/Kuala_Lumpur (GMT+08:00)',
    tzCode: 'asia/kuala_lumpur',
    name: '(GMT+08:00) Kota Bharu, Kuala Lumpur, Klang, Kampung Baru Subang, Johor Bahru',
    utc: '+08:00',
    id: 358
  },
  {
    label: 'Asia/Kuching (GMT+08:00)',
    tzCode: 'asia/kuching',
    name: '(GMT+08:00) Kuching, Kota Kinabalu, Sandakan, Tawau, Miri',
    utc: '+08:00',
    id: 359
  },
  {
    label: 'Asia/Macau (GMT+08:00)',
    tzCode: 'asia/macau',
    name: '(GMT+08:00) Macau',
    utc: '+08:00',
    id: 360
  },
  {
    label: 'Asia/Makassar (GMT+08:00)',
    tzCode: 'asia/makassar',
    name: '(GMT+08:00) Makassar, Denpasar, City of Balikpapan, Banjarmasin, Manado',
    utc: '+08:00',
    id: 361
  },
  {
    label: 'Asia/Manila (GMT+08:00)',
    tzCode: 'asia/manila',
    name: '(GMT+08:00) Quezon City, Manila, Caloocan City, Budta, Davao',
    utc: '+08:00',
    id: 362
  },
  {
    label: 'Asia/Shanghai (GMT+08:00)',
    tzCode: 'asia/shanghai',
    name: '(GMT+08:00) Shanghai, Beijing, Tianjin, Guangzhou, Shenzhen',
    utc: '+08:00',
    id: 363
  },
  {
    label: 'Asia/Singapore (GMT+08:00)',
    tzCode: 'asia/singapore',
    name: '(GMT+08:00) Singapore, Woodlands',
    utc: '+08:00',
    id: 364
  },
  {
    label: 'Asia/Taipei (GMT+08:00)',
    tzCode: 'asia/taipei',
    name: '(GMT+08:00) Taipei, Kaohsiung, Taichung, Tainan, Banqiao',
    utc: '+08:00',
    id: 365
  },
  {
    label: 'Asia/Ulaanbaatar (GMT+08:00)',
    tzCode: 'asia/ulaanbaatar',
    name: '(GMT+08:00) Ulan Bator, Erdenet, Darhan, Hovd, Mörön',
    utc: '+08:00',
    id: 366
  },
  {
    label: 'Australia/Perth (GMT+08:00)',
    tzCode: 'australia/perth',
    name: '(GMT+08:00) Perth, Rockingham, Mandurah, Bunbury, Albany',
    utc: '+08:00',
    id: 367
  },
  {
    label: 'Australia/Eucla (GMT+08:45)',
    tzCode: 'australia/eucla',
    name: '(GMT+08:45) Eucla',
    utc: '+08:45',
    id: 368
  },
  {
    label: 'Asia/Chita (GMT+09:00)',
    tzCode: 'asia/chita',
    name: '(GMT+09:00) Chita, Krasnokamensk, Borzya, Petrovsk-Zabaykal’skiy, Aginskoye',
    utc: '+09:00',
    id: 369
  },
  {
    label: 'Asia/Dili (GMT+09:00)',
    tzCode: 'asia/dili',
    name: '(GMT+09:00) Dili, Maliana, Suai, Likisá, Aileu',
    utc: '+09:00',
    id: 370
  },
  {
    label: 'Asia/Jayapura (GMT+09:00)',
    tzCode: 'asia/jayapura',
    name: '(GMT+09:00) Ambon, Jayapura, Sorong, Ternate, Abepura',
    utc: '+09:00',
    id: 371
  },
  {
    label: 'Asia/Khandyga (GMT+09:00)',
    tzCode: 'asia/khandyga',
    name: '(GMT+09:00) Khandyga',
    utc: '+09:00',
    id: 372
  },
  {
    label: 'Asia/Pyongyang (GMT+09:00)',
    tzCode: 'asia/pyongyang',
    name: '(GMT+09:00) Pyongyang, Hamhŭng, Namp’o, Sunch’ŏn, Hŭngnam',
    utc: '+09:00',
    id: 373
  },
  {
    label: 'Asia/Seoul (GMT+09:00)',
    tzCode: 'asia/seoul',
    name: '(GMT+09:00) Seoul, Busan, Incheon, Daegu, Daejeon',
    utc: '+09:00',
    id: 374
  },
  {
    label: 'Asia/Tokyo (GMT+09:00)',
    tzCode: 'asia/tokyo',
    name: '(GMT+09:00) Tokyo, Yokohama, Osaka, Nagoya, Sapporo',
    utc: '+09:00',
    id: 375
  },
  {
    label: 'Asia/Yakutsk (GMT+09:00)',
    tzCode: 'asia/yakutsk',
    name: '(GMT+09:00) Yakutsk, Blagoveshchensk, Belogorsk, Neryungri, Svobodnyy',
    utc: '+09:00',
    id: 376
  },
  {
    label: 'Pacific/Palau (GMT+09:00)',
    tzCode: 'pacific/palau',
    name: '(GMT+09:00) Koror, Koror Town, Kloulklubed, Ulimang, Mengellang',
    utc: '+09:00',
    id: 377
  },
  {
    label: 'Australia/Adelaide (GMT+09:30)',
    tzCode: 'australia/adelaide',
    name: '(GMT+09:30) Adelaide, Adelaide Hills, Mount Gambier, Morphett Vale, Gawler',
    utc: '+09:30',
    id: 378
  },
  {
    label: 'Australia/Broken_Hill (GMT+09:30)',
    tzCode: 'australia/broken_hill',
    name: '(GMT+09:30) Broken Hill',
    utc: '+09:30',
    id: 379
  },
  {
    label: 'Australia/Darwin (GMT+09:30)',
    tzCode: 'australia/darwin',
    name: '(GMT+09:30) Darwin, Alice Springs, Palmerston, Howard Springs',
    utc: '+09:30',
    id: 380
  },
  {
    label: 'Antarctica/DumontDUrville (GMT+10:00)',
    tzCode: 'antarctica/dumontdurville',
    name: '(GMT+10:00) DumontDUrville',
    utc: '+10:00',
    id: 381
  },
  {
    label: 'Antarctica/Macquarie (GMT+10:00)',
    tzCode: 'antarctica/macquarie',
    name: '(GMT+10:00) Macquarie',
    utc: '+10:00',
    id: 382
  },
  {
    label: 'Asia/Ust-Nera (GMT+10:00)',
    tzCode: 'asia/ust-nera',
    name: '(GMT+10:00) Ust-Nera',
    utc: '+10:00',
    id: 383
  },
  {
    label: 'Asia/Vladivostok (GMT+10:00)',
    tzCode: 'asia/vladivostok',
    name: '(GMT+10:00) Vladivostok, Khabarovsk, Khabarovsk Vtoroy, Komsomolsk-on-Amur, Ussuriysk',
    utc: '+10:00',
    id: 384
  },
  {
    label: 'Australia/Brisbane (GMT+10:00)',
    tzCode: 'australia/brisbane',
    name: '(GMT+10:00) Brisbane, Gold Coast, Logan City, Townsville, Cairns',
    utc: '+10:00',
    id: 385
  },
  {
    label: 'Australia/Currie (GMT+10:00)',
    tzCode: 'australia/currie',
    name: '(GMT+10:00) Currie',
    utc: '+10:00',
    id: 386
  },
  {
    label: 'Australia/Hobart (GMT+10:00)',
    tzCode: 'australia/hobart',
    name: '(GMT+10:00) Hobart, Launceston, Burnie, Devonport, Sandy Bay',
    utc: '+10:00',
    id: 387
  },
  {
    label: 'Australia/Lindeman (GMT+10:00)',
    tzCode: 'australia/lindeman',
    name: '(GMT+10:00) Lindeman',
    utc: '+10:00',
    id: 388
  },
  {
    label: 'Australia/Melbourne (GMT+10:00)',
    tzCode: 'australia/melbourne',
    name: '(GMT+10:00) Melbourne, Geelong, Bendigo, Ballarat, Melbourne City Centre',
    utc: '+10:00',
    id: 389
  },
  {
    label: 'Australia/Sydney (GMT+10:00)',
    tzCode: 'australia/sydney',
    name: '(GMT+10:00) Sydney, Canberra, Newcastle, Wollongong, Maitland',
    utc: '+10:00',
    id: 390
  },
  {
    label: 'Pacific/Chuuk (GMT+10:00)',
    tzCode: 'pacific/chuuk',
    name: '(GMT+10:00) Weno, Colonia',
    utc: '+10:00',
    id: 391
  },
  {
    label: 'Pacific/Guam (GMT+10:00)',
    tzCode: 'pacific/guam',
    name: '(GMT+10:00) Dededo Village, Yigo Village, Tamuning, Tamuning-Tumon-Harmon Village, Mangilao Village',
    utc: '+10:00',
    id: 392
  },
  {
    label: 'Pacific/Port_Moresby (GMT+10:00)',
    tzCode: 'pacific/port_moresby',
    name: '(GMT+10:00) Port Moresby, Lae, Mount Hagen, Popondetta, Madang',
    utc: '+10:00',
    id: 393
  },
  {
    label: 'Pacific/Saipan (GMT+10:00)',
    tzCode: 'pacific/saipan',
    name: '(GMT+10:00) Saipan, San Jose Village',
    utc: '+10:00',
    id: 394
  },
  {
    label: 'Australia/Lord_Howe (GMT+10:30)',
    tzCode: 'australia/lord_howe',
    name: '(GMT+10:30) Lord Howe',
    utc: '+10:30',
    id: 395
  },
  {
    label: 'Antarctica/Casey (GMT+11:00)',
    tzCode: 'antarctica/casey',
    name: '(GMT+11:00) Casey',
    utc: '+11:00',
    id: 396
  },
  {
    label: 'Asia/Magadan (GMT+11:00)',
    tzCode: 'asia/magadan',
    name: '(GMT+11:00) Magadan, Ust-Nera, Susuman, Ola',
    utc: '+11:00',
    id: 397
  },
  {
    label: 'Asia/Sakhalin (GMT+11:00)',
    tzCode: 'asia/sakhalin',
    name: '(GMT+11:00) Yuzhno-Sakhalinsk, Korsakov, Kholmsk, Okha, Nevel’sk',
    utc: '+11:00',
    id: 398
  },
  {
    label: 'Asia/Srednekolymsk (GMT+11:00)',
    tzCode: 'asia/srednekolymsk',
    name: '(GMT+11:00) Srednekolymsk',
    utc: '+11:00',
    id: 399
  },
  {
    label: 'Pacific/Bougainville (GMT+11:00)',
    tzCode: 'pacific/bougainville',
    name: '(GMT+11:00) Arawa, Buka',
    utc: '+11:00',
    id: 400
  },
  {
    label: 'Pacific/Efate (GMT+11:00)',
    tzCode: 'pacific/efate',
    name: '(GMT+11:00) Port-Vila, Luganville, Isangel, Sola, Lakatoro',
    utc: '+11:00',
    id: 401
  },
  {
    label: 'Pacific/Guadalcanal (GMT+11:00)',
    tzCode: 'pacific/guadalcanal',
    name: '(GMT+11:00) Honiara, Malango, Auki, Gizo, Buala',
    utc: '+11:00',
    id: 402
  },
  {
    label: 'Pacific/Kosrae (GMT+11:00)',
    tzCode: 'pacific/kosrae',
    name: '(GMT+11:00) Tofol',
    utc: '+11:00',
    id: 403
  },
  {
    label: 'Pacific/Norfolk (GMT+11:00)',
    tzCode: 'pacific/norfolk',
    name: '(GMT+11:00) Kingston',
    utc: '+11:00',
    id: 404
  },
  {
    label: 'Pacific/Noumea (GMT+11:00)',
    tzCode: 'pacific/noumea',
    name: '(GMT+11:00) Nouméa, Mont-Dore, Dumbéa, Païta, Wé',
    utc: '+11:00',
    id: 405
  },
  {
    label: 'Pacific/Pohnpei (GMT+11:00)',
    tzCode: 'pacific/pohnpei',
    name: '(GMT+11:00) Kolonia, Kolonia Town, Palikir - National Government Center',
    utc: '+11:00',
    id: 406
  },
  {
    label: 'Antarctica/McMurdo (GMT+12:00)',
    tzCode: 'antarctica/mcmurdo',
    name: '(GMT+12:00) McMurdo',
    utc: '+12:00',
    id: 407
  },
  {
    label: 'Asia/Anadyr (GMT+12:00)',
    tzCode: 'asia/anadyr',
    name: '(GMT+12:00) Anadyr, Bilibino',
    utc: '+12:00',
    id: 408
  },
  {
    label: 'Asia/Kamchatka (GMT+12:00)',
    tzCode: 'asia/kamchatka',
    name: '(GMT+12:00) Petropavlovsk-Kamchatsky, Yelizovo, Vilyuchinsk, Klyuchi, Mil’kovo',
    utc: '+12:00',
    id: 409
  },
  {
    label: 'Pacific/Auckland (GMT+12:00)',
    tzCode: 'pacific/auckland',
    name: '(GMT+12:00) Auckland, Wellington, Christchurch, Manukau City, North Shore',
    utc: '+12:00',
    id: 410
  },
  {
    label: 'Pacific/Fiji (GMT+12:00)',
    tzCode: 'pacific/fiji',
    name: '(GMT+12:00) Suva, Lautoka, Nadi, Labasa, Ba',
    utc: '+12:00',
    id: 411
  },
  {
    label: 'Pacific/Funafuti (GMT+12:00)',
    tzCode: 'pacific/funafuti',
    name: '(GMT+12:00) Funafuti, Savave Village, Tanrake Village, Toga Village, Asau Village',
    utc: '+12:00',
    id: 412
  },
  {
    label: 'Pacific/Kwajalein (GMT+12:00)',
    tzCode: 'pacific/kwajalein',
    name: '(GMT+12:00) Ebaye, Jabat',
    utc: '+12:00',
    id: 413
  },
  {
    label: 'Pacific/Majuro (GMT+12:00)',
    tzCode: 'pacific/majuro',
    name: '(GMT+12:00) Majuro, Arno, Jabor, Wotje, Mili',
    utc: '+12:00',
    id: 414
  },
  {
    label: 'Pacific/Nauru (GMT+12:00)',
    tzCode: 'pacific/nauru',
    name: '(GMT+12:00) Yaren, Baiti, Anabar, Uaboe, Ijuw',
    utc: '+12:00',
    id: 415
  },
  {
    label: 'Pacific/Tarawa (GMT+12:00)',
    tzCode: 'pacific/tarawa',
    name: '(GMT+12:00) Tarawa, Betio Village, Bikenibeu Village',
    utc: '+12:00',
    id: 416
  },
  {
    label: 'Pacific/Wake (GMT+12:00)',
    tzCode: 'pacific/wake',
    name: '(GMT+12:00) Wake',
    utc: '+12:00',
    id: 417
  },
  {
    label: 'Pacific/Wallis (GMT+12:00)',
    tzCode: 'pacific/wallis',
    name: '(GMT+12:00) Mata-Utu, Leava, Alo',
    utc: '+12:00',
    id: 418
  },
  {
    label: 'Pacific/Chatham (GMT+12:45)',
    tzCode: 'pacific/chatham',
    name: '(GMT+12:45) Waitangi',
    utc: '+12:45',
    id: 419
  },
  {
    label: 'Pacific/Apia (GMT+13:00)',
    tzCode: 'pacific/apia',
    name: '(GMT+13:00) Apia, Asau, Mulifanua, Afega, Leulumoega',
    utc: '+13:00',
    id: 420
  },
  {
    label: 'Pacific/Enderbury (GMT+13:00)',
    tzCode: 'pacific/enderbury',
    name: '(GMT+13:00) Enderbury',
    utc: '+13:00',
    id: 421
  },
  {
    label: 'Pacific/Fakaofo (GMT+13:00)',
    tzCode: 'pacific/fakaofo',
    name: '(GMT+13:00) Atafu Village, Nukunonu, Fale old settlement',
    utc: '+13:00',
    id: 422
  },
  {
    label: 'Pacific/Tongatapu (GMT+13:00)',
    tzCode: 'pacific/tongatapu',
    name: '(GMT+13:00) Nuku‘alofa, Lapaha, Neiafu, Pangai, ‘Ohonua',
    utc: '+13:00',
    id: 423
  },
  {
    label: 'Pacific/Kiritimati (GMT+14:00)',
    tzCode: 'pacific/kiritimati',
    name: '(GMT+14:00) Kiritimati',
    utc: '+14:00',
    id: 424
  }
].map(tz => ({
  ...tz,
  utcOffsetInMinutes: getUtcOffsetInMinutes(tz.utc)
}));
