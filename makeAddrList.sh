#!/bin/bash



# -------------------------------------------------------------------------
# parse command line options
# -------------------------------------------------------------------------
NAME=$(echo "$0" | sed "s/.*\/\(.*\)/\1/")
DSP_HELP=""
VERBOSE=""
TOKEN_NAME=""
TOKEN_ADDR=""
OUTPUT_FILE=""
ALL_TURMS=""
ONLY_TURMS=""
while [ $# -gt 0 ]; do
    case "$1" in
    -h)               DSP_HELP="Yes";;
    --help)           DSP_HELP="Yes";;
    -v)               VERBOSE="Yes";;
    --debug)          VERBOSE="Yes";;
    --verbose)        VERBOSE="Yes";;
    --only-turms)     ONLY_TURMS="Yes";;
    --all-turms)      ALL_TURMS="Yes";;
    *)
	if [ -n "$ALL_TURMS" ]; then
	    if [ -z "$OUTPUT_FILE" ]; then
		OUTPUT_FILE="$1"
	    else
		DSP_HELP="Yes"
	    fi
	elif [ -z "$TOKEN_NAME" ]; then
	    TOKEN_NAME="$1"
	elif [ -z "$TOKEN_ADDR" ]; then
	    TOKEN_ADDR="$1"
	elif [ -z "$OUTPUT_FILE" ]; then
	    OUTPUT_FILE="$1"
	else
	    DSP_HELP="Yes"
	fi;;
    esac
    shift
done


# -------------------------------------------------------------------------
# help message code
# -------------------------------------------------------------------------
if [[ ("$DSP_HELP" != ""                                                                         ) ||
      ("$ALL_TURMS" == "" && ("$TOKEN_NAME" == "" || "$TOKEN_ADDR" == "" || "$OUTPUT_FILE" == "")) ||
      ("$ALL_TURMS" != "" && ("$TOKEN_NAME" != "" || "$TOKEN_ADDR" != "" || "$OUTPUT_FILE" == ""))  ]]; then
    cat <<EOF
$NAME
this tool makes a list of all addresses that own the specified ERC20 token.
 usage:
 $NAME [options] <token name> <token address> <output_file>
 options are:
 -h                 causes this message to be displayed. alternate form --help.
 -v                 causes us to be verbose. If this option is specified,
                    extra, explanitory messages might be displayed.
                    an alternate form for this option is --verbose.
 --only-turms       only display addresses that are registered with Turms AMT.
 --all-turms        display all addresses that are registered with Turms AMT.
                    this implies --only-turms. also no other parameters should
                    be specified, except output file.

eg:
 ./makeAddrList.sh OWN 0x1460a58096d80a50a2F1f956DDA497611Fa4f165 OWN_addr_list.txt
or
 ./makeAddrList.sh --all-turms all_turms_addr_list.txt
EOF
    exit 0
fi


#
#
#
TURMS_OPT=""
if [ -n "$ONLY_TURMS" ]; then
    TURMS_OPT="--only-turms"
fi
VERBOSE_OPT=""
if [ -n "$VERBOSE" ]; then
    VERBOSE_OPT="--verbose"
fi

echo "#" > "$OUTPUT_FILE"
if [ -n "$ALL_TURMS" ]; then
    echo "# list of all turms addresses" >> "$OUTPUT_FILE"
else
    echo "# list of all holders of token: $TOKEN_NAME" >> "$OUTPUT_FILE"
    echo "# token address: $TOKEN_ADDR" >> "$OUTPUT_FILE"
fi
echo "#" >> "$OUTPUT_FILE"
ALL_ADDR_FILE=$(mktemp /tmp/makeAddrList.all.XXXXXX)
SORT_ADDR_FILE=$(mktemp /tmp/makeAddrList.sort.XXXXXX)
if [ -n "$VERBOSE" ]; then
    echo "collecting addresses"
fi
node makeAddrList "$VERBOSE_OPT" "$TURMS_OPT" "$TOKEN_ADDR" > $ALL_ADDR_FILE
if [ -n "$VERBOSE" ]; then
    echo "sorting addresses"
fi
cat $ALL_ADDR_FILE | sort > $SORT_ADDR_FILE
if [ -n "$VERBOSE" ]; then
    echo "finding unique addresses"
fi
cat $SORT_ADDR_FILE | uniq >> "$OUTPUT_FILE"
if [ -n "$VERBOSE" ]; then
    echo "addresses saved to $OUTPUT_FILE"
fi
rm $ALL_ADDR_FILE $SORT_ADDR_FILE
