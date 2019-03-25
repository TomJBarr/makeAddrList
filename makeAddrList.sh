#!/bin/bash

#
# $1 token name
# $2 token addr
# $3 output file
#
#
# eg:
#  ./makeAddrList.sh OWN 0x1460a58096d80a50a2F1f956DDA497611Fa4f165 OWN_addr_list.txt
#
echo "#" > $3
echo "# list of all holders of token: $1" >> $3
echo "# token address: $2" >> $3
echo "#" >> $3
node makeAddrList $2 | sort | uniq >> $3
