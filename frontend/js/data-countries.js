// All countries of the world with flag emojis, dial codes, and validation rules
(function() {
  window.COUNTRIES = [
  {
    "name": "Afghanistan",
    "code": "AF",
    "dial_code": "+93",
    "flag": "🇦🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "Aland Islands",
    "code": "AX",
    "dial_code": "+358",
    "flag": "🇦🇽",
    "min": 7,
    "max": 13
  },
  {
    "name": "Albania",
    "code": "AL",
    "dial_code": "+355",
    "flag": "🇦🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Algeria",
    "code": "DZ",
    "dial_code": "+213",
    "flag": "🇩🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "American Samoa",
    "code": "AS",
    "dial_code": "+1684",
    "flag": "🇦🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "Andorra",
    "code": "AD",
    "dial_code": "+376",
    "flag": "🇦🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Angola",
    "code": "AO",
    "dial_code": "+244",
    "flag": "🇦🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Anguilla",
    "code": "AI",
    "dial_code": "+1264",
    "flag": "🇦🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Antarctica",
    "code": "AQ",
    "dial_code": "+672",
    "flag": "🇦🇶",
    "min": 7,
    "max": 13
  },
  {
    "name": "Antigua and Barbuda",
    "code": "AG",
    "dial_code": "+1268",
    "flag": "🇦🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Argentina",
    "code": "AR",
    "dial_code": "+54",
    "flag": "🇦🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Armenia",
    "code": "AM",
    "dial_code": "+374",
    "flag": "🇦🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Aruba",
    "code": "AW",
    "dial_code": "+297",
    "flag": "🇦🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Australia",
    "code": "AU",
    "dial_code": "+61",
    "flag": "🇦🇺",
    "min": 9,
    "max": 9
  },
  {
    "name": "Austria",
    "code": "AT",
    "dial_code": "+43",
    "flag": "🇦🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Azerbaijan",
    "code": "AZ",
    "dial_code": "+994",
    "flag": "🇦🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bahamas",
    "code": "BS",
    "dial_code": "+1242",
    "flag": "🇧🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bahrain",
    "code": "BH",
    "dial_code": "+973",
    "flag": "🇧🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bangladesh",
    "code": "BD",
    "dial_code": "+880",
    "flag": "🇧🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Barbados",
    "code": "BB",
    "dial_code": "+1246",
    "flag": "🇧🇧",
    "min": 7,
    "max": 13
  },
  {
    "name": "Belarus",
    "code": "BY",
    "dial_code": "+375",
    "flag": "🇧🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Belgium",
    "code": "BE",
    "dial_code": "+32",
    "flag": "🇧🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Belize",
    "code": "BZ",
    "dial_code": "+501",
    "flag": "🇧🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Benin",
    "code": "BJ",
    "dial_code": "+229",
    "flag": "🇧🇯",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bermuda",
    "code": "BM",
    "dial_code": "+1441",
    "flag": "🇧🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bhutan",
    "code": "BT",
    "dial_code": "+975",
    "flag": "🇧🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bolivia, Plurinational State of",
    "code": "BO",
    "dial_code": "+591",
    "flag": "🇧🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bosnia and Herzegovina",
    "code": "BA",
    "dial_code": "+387",
    "flag": "🇧🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Botswana",
    "code": "BW",
    "dial_code": "+267",
    "flag": "🇧🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Brazil",
    "code": "BR",
    "dial_code": "+55",
    "flag": "🇧🇷",
    "min": 10,
    "max": 11
  },
  {
    "name": "British Indian Ocean Territory",
    "code": "IO",
    "dial_code": "+246",
    "flag": "🇮🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "British Virgin Islands",
    "code": "VG",
    "dial_code": "+1284",
    "flag": "🇻🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Brunei Darussalam",
    "code": "BN",
    "dial_code": "+673",
    "flag": "🇧🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Bulgaria",
    "code": "BG",
    "dial_code": "+359",
    "flag": "🇧🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Burkina Faso",
    "code": "BF",
    "dial_code": "+226",
    "flag": "🇧🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "Burundi",
    "code": "BI",
    "dial_code": "+257",
    "flag": "🇧🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cambodia",
    "code": "KH",
    "dial_code": "+855",
    "flag": "🇰🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cameroon",
    "code": "CM",
    "dial_code": "+237",
    "flag": "🇨🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Canada",
    "code": "CA",
    "dial_code": "+1",
    "flag": "🇨🇦",
    "min": 10,
    "max": 10
  },
  {
    "name": "Cape Verde",
    "code": "CV",
    "dial_code": "+238",
    "flag": "🇨🇻",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cayman Islands",
    "code": "KY",
    "dial_code": "+ 345",
    "flag": "🇰🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Central African Republic",
    "code": "CF",
    "dial_code": "+236",
    "flag": "🇨🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "Chad",
    "code": "TD",
    "dial_code": "+235",
    "flag": "🇹🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Chile",
    "code": "CL",
    "dial_code": "+56",
    "flag": "🇨🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "China",
    "code": "CN",
    "dial_code": "+86",
    "flag": "🇨🇳",
    "min": 11,
    "max": 11
  },
  {
    "name": "Christmas Island",
    "code": "CX",
    "dial_code": "+61",
    "flag": "🇨🇽",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cocos (Keeling) Islands",
    "code": "CC",
    "dial_code": "+61",
    "flag": "🇨🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "Colombia",
    "code": "CO",
    "dial_code": "+57",
    "flag": "🇨🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Comoros",
    "code": "KM",
    "dial_code": "+269",
    "flag": "🇰🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Congo",
    "code": "CG",
    "dial_code": "+242",
    "flag": "🇨🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Congo, The Democratic Republic of the Congo",
    "code": "CD",
    "dial_code": "+243",
    "flag": "🇨🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cook Islands",
    "code": "CK",
    "dial_code": "+682",
    "flag": "🇨🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Costa Rica",
    "code": "CR",
    "dial_code": "+506",
    "flag": "🇨🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cote d'Ivoire",
    "code": "CI",
    "dial_code": "+225",
    "flag": "🇨🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Croatia",
    "code": "HR",
    "dial_code": "+385",
    "flag": "🇭🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cuba",
    "code": "CU",
    "dial_code": "+53",
    "flag": "🇨🇺",
    "min": 7,
    "max": 13
  },
  {
    "name": "Cyprus",
    "code": "CY",
    "dial_code": "+357",
    "flag": "🇨🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Czech Republic",
    "code": "CZ",
    "dial_code": "+420",
    "flag": "🇨🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Denmark",
    "code": "DK",
    "dial_code": "+45",
    "flag": "🇩🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Djibouti",
    "code": "DJ",
    "dial_code": "+253",
    "flag": "🇩🇯",
    "min": 7,
    "max": 13
  },
  {
    "name": "Dominica",
    "code": "DM",
    "dial_code": "+1767",
    "flag": "🇩🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Dominican Republic",
    "code": "DO",
    "dial_code": "+1849",
    "flag": "🇩🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Ecuador",
    "code": "EC",
    "dial_code": "+593",
    "flag": "🇪🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "Egypt",
    "code": "EG",
    "dial_code": "+20",
    "flag": "🇪🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "El Salvador",
    "code": "SV",
    "dial_code": "+503",
    "flag": "🇸🇻",
    "min": 7,
    "max": 13
  },
  {
    "name": "Equatorial Guinea",
    "code": "GQ",
    "dial_code": "+240",
    "flag": "🇬🇶",
    "min": 7,
    "max": 13
  },
  {
    "name": "Eritrea",
    "code": "ER",
    "dial_code": "+291",
    "flag": "🇪🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Estonia",
    "code": "EE",
    "dial_code": "+372",
    "flag": "🇪🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Ethiopia",
    "code": "ET",
    "dial_code": "+251",
    "flag": "🇪🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Falkland Islands",
    "code": "FK",
    "dial_code": "+500",
    "flag": "🇫🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Faroe Islands",
    "code": "FO",
    "dial_code": "+298",
    "flag": "🇫🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Fiji",
    "code": "FJ",
    "dial_code": "+679",
    "flag": "🇫🇯",
    "min": 7,
    "max": 13
  },
  {
    "name": "Finland",
    "code": "FI",
    "dial_code": "+358",
    "flag": "🇫🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "France",
    "code": "FR",
    "dial_code": "+33",
    "flag": "🇫🇷",
    "min": 9,
    "max": 9
  },
  {
    "name": "French Guiana",
    "code": "GF",
    "dial_code": "+594",
    "flag": "🇬🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "French Polynesia",
    "code": "PF",
    "dial_code": "+689",
    "flag": "🇵🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "Gabon",
    "code": "GA",
    "dial_code": "+241",
    "flag": "🇬🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Gambia",
    "code": "GM",
    "dial_code": "+220",
    "flag": "🇬🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Georgia",
    "code": "GE",
    "dial_code": "+995",
    "flag": "🇬🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Germany",
    "code": "DE",
    "dial_code": "+49",
    "flag": "🇩🇪",
    "min": 10,
    "max": 11
  },
  {
    "name": "Ghana",
    "code": "GH",
    "dial_code": "+233",
    "flag": "🇬🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Gibraltar",
    "code": "GI",
    "dial_code": "+350",
    "flag": "🇬🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Greece",
    "code": "GR",
    "dial_code": "+30",
    "flag": "🇬🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Greenland",
    "code": "GL",
    "dial_code": "+299",
    "flag": "🇬🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Grenada",
    "code": "GD",
    "dial_code": "+1473",
    "flag": "🇬🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Guadeloupe",
    "code": "GP",
    "dial_code": "+590",
    "flag": "🇬🇵",
    "min": 7,
    "max": 13
  },
  {
    "name": "Guam",
    "code": "GU",
    "dial_code": "+1671",
    "flag": "🇬🇺",
    "min": 7,
    "max": 13
  },
  {
    "name": "Guatemala",
    "code": "GT",
    "dial_code": "+502",
    "flag": "🇬🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Guernsey",
    "code": "GG",
    "dial_code": "+44",
    "flag": "🇬🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Guinea",
    "code": "GN",
    "dial_code": "+224",
    "flag": "🇬🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Guinea-Bissau",
    "code": "GW",
    "dial_code": "+245",
    "flag": "🇬🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Guyana",
    "code": "GY",
    "dial_code": "+595",
    "flag": "🇬🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Haiti",
    "code": "HT",
    "dial_code": "+509",
    "flag": "🇭🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Holy See (Vatican City State)",
    "code": "VA",
    "dial_code": "+379",
    "flag": "🇻🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Honduras",
    "code": "HN",
    "dial_code": "+504",
    "flag": "🇭🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Hong Kong",
    "code": "HK",
    "dial_code": "+852",
    "flag": "🇭🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Hungary",
    "code": "HU",
    "dial_code": "+36",
    "flag": "🇭🇺",
    "min": 7,
    "max": 13
  },
  {
    "name": "Iceland",
    "code": "IS",
    "dial_code": "+354",
    "flag": "🇮🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "India",
    "code": "IN",
    "dial_code": "+91",
    "flag": "🇮🇳",
    "min": 10,
    "max": 10
  },
  {
    "name": "Indonesia",
    "code": "ID",
    "dial_code": "+62",
    "flag": "🇮🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Iran, Islamic Republic of Persian Gulf",
    "code": "IR",
    "dial_code": "+98",
    "flag": "🇮🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Iraq",
    "code": "IQ",
    "dial_code": "+964",
    "flag": "🇮🇶",
    "min": 7,
    "max": 13
  },
  {
    "name": "Ireland",
    "code": "IE",
    "dial_code": "+353",
    "flag": "🇮🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Isle of Man",
    "code": "IM",
    "dial_code": "+44",
    "flag": "🇮🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Israel",
    "code": "IL",
    "dial_code": "+972",
    "flag": "🇮🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Italy",
    "code": "IT",
    "dial_code": "+39",
    "flag": "🇮🇹",
    "min": 9,
    "max": 11
  },
  {
    "name": "Jamaica",
    "code": "JM",
    "dial_code": "+1876",
    "flag": "🇯🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Japan",
    "code": "JP",
    "dial_code": "+81",
    "flag": "🇯🇵",
    "min": 10,
    "max": 10
  },
  {
    "name": "Jersey",
    "code": "JE",
    "dial_code": "+44",
    "flag": "🇯🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Jordan",
    "code": "JO",
    "dial_code": "+962",
    "flag": "🇯🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Kazakhstan",
    "code": "KZ",
    "dial_code": "+77",
    "flag": "🇰🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Kenya",
    "code": "KE",
    "dial_code": "+254",
    "flag": "🇰🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Kiribati",
    "code": "KI",
    "dial_code": "+686",
    "flag": "🇰🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Korea, Democratic People's Republic of Korea",
    "code": "KP",
    "dial_code": "+850",
    "flag": "🇰🇵",
    "min": 7,
    "max": 13
  },
  {
    "name": "Korea, Republic of South Korea",
    "code": "KR",
    "dial_code": "+82",
    "flag": "🇰🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Kuwait",
    "code": "KW",
    "dial_code": "+965",
    "flag": "🇰🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Kyrgyzstan",
    "code": "KG",
    "dial_code": "+996",
    "flag": "🇰🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Laos",
    "code": "LA",
    "dial_code": "+856",
    "flag": "🇱🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Latvia",
    "code": "LV",
    "dial_code": "+371",
    "flag": "🇱🇻",
    "min": 7,
    "max": 13
  },
  {
    "name": "Lebanon",
    "code": "LB",
    "dial_code": "+961",
    "flag": "🇱🇧",
    "min": 7,
    "max": 13
  },
  {
    "name": "Lesotho",
    "code": "LS",
    "dial_code": "+266",
    "flag": "🇱🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "Liberia",
    "code": "LR",
    "dial_code": "+231",
    "flag": "🇱🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Libyan Arab Jamahiriya",
    "code": "LY",
    "dial_code": "+218",
    "flag": "🇱🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Liechtenstein",
    "code": "LI",
    "dial_code": "+423",
    "flag": "🇱🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Lithuania",
    "code": "LT",
    "dial_code": "+370",
    "flag": "🇱🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Luxembourg",
    "code": "LU",
    "dial_code": "+352",
    "flag": "🇱🇺",
    "min": 7,
    "max": 13
  },
  {
    "name": "Macao",
    "code": "MO",
    "dial_code": "+853",
    "flag": "🇲🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Macedonia",
    "code": "MK",
    "dial_code": "+389",
    "flag": "🇲🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Madagascar",
    "code": "MG",
    "dial_code": "+261",
    "flag": "🇲🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Malawi",
    "code": "MW",
    "dial_code": "+265",
    "flag": "🇲🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Malaysia",
    "code": "MY",
    "dial_code": "+60",
    "flag": "🇲🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Maldives",
    "code": "MV",
    "dial_code": "+960",
    "flag": "🇲🇻",
    "min": 7,
    "max": 13
  },
  {
    "name": "Mali",
    "code": "ML",
    "dial_code": "+223",
    "flag": "🇲🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Malta",
    "code": "MT",
    "dial_code": "+356",
    "flag": "🇲🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Marshall Islands",
    "code": "MH",
    "dial_code": "+692",
    "flag": "🇲🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Martinique",
    "code": "MQ",
    "dial_code": "+596",
    "flag": "🇲🇶",
    "min": 7,
    "max": 13
  },
  {
    "name": "Mauritania",
    "code": "MR",
    "dial_code": "+222",
    "flag": "🇲🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Mauritius",
    "code": "MU",
    "dial_code": "+230",
    "flag": "🇲🇺",
    "min": 7,
    "max": 13
  },
  {
    "name": "Mayotte",
    "code": "YT",
    "dial_code": "+262",
    "flag": "🇾🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Mexico",
    "code": "MX",
    "dial_code": "+52",
    "flag": "🇲🇽",
    "min": 10,
    "max": 10
  },
  {
    "name": "Micronesia, Federated States of Micronesia",
    "code": "FM",
    "dial_code": "+691",
    "flag": "🇫🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Moldova",
    "code": "MD",
    "dial_code": "+373",
    "flag": "🇲🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Monaco",
    "code": "MC",
    "dial_code": "+377",
    "flag": "🇲🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "Mongolia",
    "code": "MN",
    "dial_code": "+976",
    "flag": "🇲🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Montenegro",
    "code": "ME",
    "dial_code": "+382",
    "flag": "🇲🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Montserrat",
    "code": "MS",
    "dial_code": "+1664",
    "flag": "🇲🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "Morocco",
    "code": "MA",
    "dial_code": "+212",
    "flag": "🇲🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Mozambique",
    "code": "MZ",
    "dial_code": "+258",
    "flag": "🇲🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Myanmar",
    "code": "MM",
    "dial_code": "+95",
    "flag": "🇲🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Namibia",
    "code": "NA",
    "dial_code": "+264",
    "flag": "🇳🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Nauru",
    "code": "NR",
    "dial_code": "+674",
    "flag": "🇳🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Nepal",
    "code": "NP",
    "dial_code": "+977",
    "flag": "🇳🇵",
    "min": 7,
    "max": 13
  },
  {
    "name": "Netherlands",
    "code": "NL",
    "dial_code": "+31",
    "flag": "🇳🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Netherlands Antilles",
    "code": "AN",
    "dial_code": "+599",
    "flag": "🇦🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "New Caledonia",
    "code": "NC",
    "dial_code": "+687",
    "flag": "🇳🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "New Zealand",
    "code": "NZ",
    "dial_code": "+64",
    "flag": "🇳🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Nicaragua",
    "code": "NI",
    "dial_code": "+505",
    "flag": "🇳🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Niger",
    "code": "NE",
    "dial_code": "+227",
    "flag": "🇳🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Nigeria",
    "code": "NG",
    "dial_code": "+234",
    "flag": "🇳🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Niue",
    "code": "NU",
    "dial_code": "+683",
    "flag": "🇳🇺",
    "min": 7,
    "max": 13
  },
  {
    "name": "Norfolk Island",
    "code": "NF",
    "dial_code": "+672",
    "flag": "🇳🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "Northern Mariana Islands",
    "code": "MP",
    "dial_code": "+1670",
    "flag": "🇲🇵",
    "min": 7,
    "max": 13
  },
  {
    "name": "Norway",
    "code": "NO",
    "dial_code": "+47",
    "flag": "🇳🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Oman",
    "code": "OM",
    "dial_code": "+968",
    "flag": "🇴🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Pakistan",
    "code": "PK",
    "dial_code": "+92",
    "flag": "🇵🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Palau",
    "code": "PW",
    "dial_code": "+680",
    "flag": "🇵🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Palestinian Territory, Occupied",
    "code": "PS",
    "dial_code": "+970",
    "flag": "🇵🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "Panama",
    "code": "PA",
    "dial_code": "+507",
    "flag": "🇵🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Papua New Guinea",
    "code": "PG",
    "dial_code": "+675",
    "flag": "🇵🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Paraguay",
    "code": "PY",
    "dial_code": "+595",
    "flag": "🇵🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Peru",
    "code": "PE",
    "dial_code": "+51",
    "flag": "🇵🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Philippines",
    "code": "PH",
    "dial_code": "+63",
    "flag": "🇵🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Pitcairn",
    "code": "PN",
    "dial_code": "+872",
    "flag": "🇵🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Poland",
    "code": "PL",
    "dial_code": "+48",
    "flag": "🇵🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Portugal",
    "code": "PT",
    "dial_code": "+351",
    "flag": "🇵🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Puerto Rico",
    "code": "PR",
    "dial_code": "+1939",
    "flag": "🇵🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Qatar",
    "code": "QA",
    "dial_code": "+974",
    "flag": "🇶🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Reunion",
    "code": "RE",
    "dial_code": "+262",
    "flag": "🇷🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Romania",
    "code": "RO",
    "dial_code": "+40",
    "flag": "🇷🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Russia",
    "code": "RU",
    "dial_code": "+7",
    "flag": "🇷🇺",
    "min": 10,
    "max": 10
  },
  {
    "name": "Rwanda",
    "code": "RW",
    "dial_code": "+250",
    "flag": "🇷🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saint Barthelemy",
    "code": "BL",
    "dial_code": "+590",
    "flag": "🇧🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saint Helena, Ascension and Tristan Da Cunha",
    "code": "SH",
    "dial_code": "+290",
    "flag": "🇸🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saint Kitts and Nevis",
    "code": "KN",
    "dial_code": "+1869",
    "flag": "🇰🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saint Lucia",
    "code": "LC",
    "dial_code": "+1758",
    "flag": "🇱🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saint Martin",
    "code": "MF",
    "dial_code": "+590",
    "flag": "🇲🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saint Pierre and Miquelon",
    "code": "PM",
    "dial_code": "+508",
    "flag": "🇵🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saint Vincent and the Grenadines",
    "code": "VC",
    "dial_code": "+1784",
    "flag": "🇻🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "Samoa",
    "code": "WS",
    "dial_code": "+685",
    "flag": "🇼🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "San Marino",
    "code": "SM",
    "dial_code": "+378",
    "flag": "🇸🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Sao Tome and Principe",
    "code": "ST",
    "dial_code": "+239",
    "flag": "🇸🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Saudi Arabia",
    "code": "SA",
    "dial_code": "+966",
    "flag": "🇸🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "Senegal",
    "code": "SN",
    "dial_code": "+221",
    "flag": "🇸🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Serbia",
    "code": "RS",
    "dial_code": "+381",
    "flag": "🇷🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "Seychelles",
    "code": "SC",
    "dial_code": "+248",
    "flag": "🇸🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "Sierra Leone",
    "code": "SL",
    "dial_code": "+232",
    "flag": "🇸🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Singapore",
    "code": "SG",
    "dial_code": "+65",
    "flag": "🇸🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Slovakia",
    "code": "SK",
    "dial_code": "+421",
    "flag": "🇸🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Slovenia",
    "code": "SI",
    "dial_code": "+386",
    "flag": "🇸🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Solomon Islands",
    "code": "SB",
    "dial_code": "+677",
    "flag": "🇸🇧",
    "min": 7,
    "max": 13
  },
  {
    "name": "Somalia",
    "code": "SO",
    "dial_code": "+252",
    "flag": "🇸🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "South Africa",
    "code": "ZA",
    "dial_code": "+27",
    "flag": "🇿🇦",
    "min": 9,
    "max": 9
  },
  {
    "name": "South Georgia and the South Sandwich Islands",
    "code": "GS",
    "dial_code": "+500",
    "flag": "🇬🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "South Sudan",
    "code": "SS",
    "dial_code": "+211",
    "flag": "🇸🇸",
    "min": 7,
    "max": 13
  },
  {
    "name": "Spain",
    "code": "ES",
    "dial_code": "+34",
    "flag": "🇪🇸",
    "min": 9,
    "max": 9
  },
  {
    "name": "Sri Lanka",
    "code": "LK",
    "dial_code": "+94",
    "flag": "🇱🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Sudan",
    "code": "SD",
    "dial_code": "+249",
    "flag": "🇸🇩",
    "min": 7,
    "max": 13
  },
  {
    "name": "Suriname",
    "code": "SR",
    "dial_code": "+597",
    "flag": "🇸🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Svalbard and Jan Mayen",
    "code": "SJ",
    "dial_code": "+47",
    "flag": "🇸🇯",
    "min": 7,
    "max": 13
  },
  {
    "name": "Swaziland",
    "code": "SZ",
    "dial_code": "+268",
    "flag": "🇸🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Sweden",
    "code": "SE",
    "dial_code": "+46",
    "flag": "🇸🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Switzerland",
    "code": "CH",
    "dial_code": "+41",
    "flag": "🇨🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Syria",
    "code": "SY",
    "dial_code": "+963",
    "flag": "🇸🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Taiwan",
    "code": "TW",
    "dial_code": "+886",
    "flag": "🇹🇼",
    "min": 7,
    "max": 13
  },
  {
    "name": "Tajikistan",
    "code": "TJ",
    "dial_code": "+992",
    "flag": "🇹🇯",
    "min": 7,
    "max": 13
  },
  {
    "name": "Tanzania, United Republic of Tanzania",
    "code": "TZ",
    "dial_code": "+255",
    "flag": "🇹🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Thailand",
    "code": "TH",
    "dial_code": "+66",
    "flag": "🇹🇭",
    "min": 7,
    "max": 13
  },
  {
    "name": "Timor-Leste",
    "code": "TL",
    "dial_code": "+670",
    "flag": "🇹🇱",
    "min": 7,
    "max": 13
  },
  {
    "name": "Togo",
    "code": "TG",
    "dial_code": "+228",
    "flag": "🇹🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Tokelau",
    "code": "TK",
    "dial_code": "+690",
    "flag": "🇹🇰",
    "min": 7,
    "max": 13
  },
  {
    "name": "Tonga",
    "code": "TO",
    "dial_code": "+676",
    "flag": "🇹🇴",
    "min": 7,
    "max": 13
  },
  {
    "name": "Trinidad and Tobago",
    "code": "TT",
    "dial_code": "+1868",
    "flag": "🇹🇹",
    "min": 7,
    "max": 13
  },
  {
    "name": "Tunisia",
    "code": "TN",
    "dial_code": "+216",
    "flag": "🇹🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Turkey",
    "code": "TR",
    "dial_code": "+90",
    "flag": "🇹🇷",
    "min": 7,
    "max": 13
  },
  {
    "name": "Turkmenistan",
    "code": "TM",
    "dial_code": "+993",
    "flag": "🇹🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Turks and Caicos Islands",
    "code": "TC",
    "dial_code": "+1649",
    "flag": "🇹🇨",
    "min": 7,
    "max": 13
  },
  {
    "name": "Tuvalu",
    "code": "TV",
    "dial_code": "+688",
    "flag": "🇹🇻",
    "min": 7,
    "max": 13
  },
  {
    "name": "U.S. Virgin Islands",
    "code": "VI",
    "dial_code": "+1340",
    "flag": "🇻🇮",
    "min": 7,
    "max": 13
  },
  {
    "name": "Uganda",
    "code": "UG",
    "dial_code": "+256",
    "flag": "🇺🇬",
    "min": 7,
    "max": 13
  },
  {
    "name": "Ukraine",
    "code": "UA",
    "dial_code": "+380",
    "flag": "🇺🇦",
    "min": 7,
    "max": 13
  },
  {
    "name": "United Arab Emirates",
    "code": "AE",
    "dial_code": "+971",
    "flag": "🇦🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "United Kingdom",
    "code": "GB",
    "dial_code": "+44",
    "flag": "🇬🇧",
    "min": 10,
    "max": 10
  },
  {
    "name": "United States",
    "code": "US",
    "dial_code": "+1",
    "flag": "🇺🇸",
    "min": 10,
    "max": 10
  },
  {
    "name": "Uruguay",
    "code": "UY",
    "dial_code": "+598",
    "flag": "🇺🇾",
    "min": 7,
    "max": 13
  },
  {
    "name": "Uzbekistan",
    "code": "UZ",
    "dial_code": "+998",
    "flag": "🇺🇿",
    "min": 7,
    "max": 13
  },
  {
    "name": "Vanuatu",
    "code": "VU",
    "dial_code": "+678",
    "flag": "🇻🇺",
    "min": 7,
    "max": 13
  },
  {
    "name": "Venezuela, Bolivarian Republic of Venezuela",
    "code": "VE",
    "dial_code": "+58",
    "flag": "🇻🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Vietnam",
    "code": "VN",
    "dial_code": "+84",
    "flag": "🇻🇳",
    "min": 7,
    "max": 13
  },
  {
    "name": "Wallis and Futuna",
    "code": "WF",
    "dial_code": "+681",
    "flag": "🇼🇫",
    "min": 7,
    "max": 13
  },
  {
    "name": "Yemen",
    "code": "YE",
    "dial_code": "+967",
    "flag": "🇾🇪",
    "min": 7,
    "max": 13
  },
  {
    "name": "Zambia",
    "code": "ZM",
    "dial_code": "+260",
    "flag": "🇿🇲",
    "min": 7,
    "max": 13
  },
  {
    "name": "Zimbabwe",
    "code": "ZW",
    "dial_code": "+263",
    "flag": "🇿🇼",
    "min": 7,
    "max": 13
  }
];
})();
