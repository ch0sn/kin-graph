# KinGraph's GEDCOM extensions

KinGraph writes GEDCOM 5.5.1 and 7.0 files. Where GEDCOM has no way to say
something KinGraph records, it adds one of the custom tags below so that a
file exported from KinGraph and imported again loses nothing. Other programs
can ignore them. GEDCOM 7 files list each tag in the header (`HEAD.SCHMA`)
with a link to its section here.

### _ROOT
`HEAD._ROOT @I1@`: the person the tree is drawn around ("me").

### _PLACEHOLDER
`INDI._PLACEHOLDER Y`: stands in for a parent who isn't known, so that
brothers and sisters can still be linked through them.

### _STATUS
`FAM._STATUS MARRIED|PARTNERED|SEPARATED|DIVORCED|WIDOWED`: how the couple
are related now.

### _START
`FAM._START` with a `DATE`: when an unmarried couple got together.

### _END
`FAM._END` with a `DATE`: when a couple who didn't divorce parted.

### _COPARENTS
`FAM._COPARENTS Y`: the two parents have a child together but aren't a
couple.

### _PATR
`NAME._PATR`: a patronymic, such as Jónsdóttir.

### _FROM
`NAME._FROM` with a date: when a name came into use.

### _TO
`NAME._TO` with a date: when a name stopped being used.

### _CURRENT
`RESI._CURRENT Y`: the residence is where the person lives now.

### _KIND
On an event: exactly what happened, where the tag alone doesn't say it, for
example `EVEN` with `_KIND promotion`.

### _CATEGORY
On an `EVEN`: which area of life it belongs to, for example `_CATEGORY military`.
