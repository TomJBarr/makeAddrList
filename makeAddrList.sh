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
ONLY_TURMS=""
while [ $# -gt 0 ]; do
    case "$1" in
    -h)               DSP_HELP="Yes";;
    --help)           DSP_HELP="Yes";;
    -v)               VERBOSE="Yes";;
    --verbose)        VERBOSE="Yes";;
    --only-turms)     ONLY_TURMS="Yes";;
    *)
    if [ -z "$TOKEN_NAME" ]; then
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
if [ -n "$DSP_HELP" -o -z "$TOKEN_NAME" -o -z "$TOKEN_ADDR" -o -z "$OUTPUT_FILE" ]; then
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

eg:
 ./makeAddrList.sh OWN 0x1460a58096d80a50a2F1f956DDA497611Fa4f165 OWN_addr_list.txt
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
echo "#" > "$OUTPUT_FILE"
echo "# list of all holders of token: $TOKEN_NAME" >> "$OUTPUT_FILE"
echo "# token address: $TOKEN_ADDR" >> "$OUTPUT_FILE"
echo "#" >> "$OUTPUT_FILE"
if [ -n "$VERBOSE" ]; then
    node makeAddrList "$TURMS_OPT" "$TOKEN_ADDR" | tee /dev/tty | sort | uniq >> "$OUTPUT_FILE"
else
    node makeAddrList "$TURMS_OPT" "$TOKEN_ADDR" | sort | uniq >> "$OUTPUT_FILE"
fi
